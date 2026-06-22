-- Migration 004: Schema improvements for production readiness and AI integration

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Replace IVFFlat with HNSW on kb_chunks
--    IVFFlat requires ~3 000+ rows before it's useful; HNSW works at any size.
-- ─────────────────────────────────────────────────────────────────────────────
DROP INDEX IF EXISTS kb_chunks_embedding_idx;
CREATE INDEX IF NOT EXISTS kb_chunks_embedding_hnsw_idx
  ON kb_chunks USING hnsw (embedding vector_cosine_ops);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Fix tenants.phone uniqueness: global → per-client
--    A tenant moving between properties (different clients) was previously
--    blocked by the global UNIQUE constraint.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_phone_key;
ALTER TABLE tenants ADD CONSTRAINT tenants_phone_client_unique UNIQUE (phone, client_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. messages: add operational and AI audit columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS twilio_sid   TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS sender_type  TEXT NOT NULL DEFAULT 'human'
    CHECK (sender_type IN ('ai', 'human', 'system')),
  ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN NOT NULL DEFAULT false,
  -- status is outbound-only; NULL is valid for inbound
  ADD COLUMN IF NOT EXISTS status       TEXT
    CHECK (status IN ('queued', 'sent', 'delivered', 'failed'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. conversations: add AI control, recency, and audit columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_enabled      BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill last_message_at from existing messages
UPDATE conversations c
SET last_message_at = (
  SELECT MAX(m.created_at) FROM messages m WHERE m.conversation_id = c.id
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. tickets: add tenant/conversation links and audit columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS tenant_id       UUID REFERENCES tenants(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_to     TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at      TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. clients: add configuration and lifecycle columns
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS ai_config         JSONB       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS escalation_config JSONB       NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS active            BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at        TIMESTAMPTZ NOT NULL DEFAULT now();

-- Migrate existing escalation_contact text into structured escalation_config
UPDATE clients
SET escalation_config = jsonb_build_object('email', escalation_contact)
WHERE escalation_contact IS NOT NULL AND escalation_contact <> '';

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. kb_chunks: add chunk position for ordered context retrieval
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE kb_chunks
  ADD COLUMN IF NOT EXISTS chunk_index INT NOT NULL DEFAULT 0;

-- Ensures chunks within a document have a deterministic, unique order
ALTER TABLE kb_chunks
  ADD CONSTRAINT kb_chunks_doc_order_unique UNIQUE (document_id, chunk_index);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. tenants / units: add updated_at
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE units   ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. managers: enforce valid role values
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE managers DROP CONSTRAINT IF EXISTS managers_role_check;
ALTER TABLE managers ADD CONSTRAINT managers_role_check
  CHECK (role IN ('admin', 'manager', 'viewer'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Shared updated_at trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_units_updated_at
  BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_conversations_updated_at
  BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_tickets_updated_at
  BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. Trigger: keep conversations.last_message_at current on insert
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_conversation_last_message_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id
    AND (last_message_at IS NULL OR NEW.created_at > last_message_at);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_messages_update_last_message_at
  AFTER INSERT ON messages FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. Indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- auth_client_id() is called on every RLS check — this is the highest priority
CREATE INDEX IF NOT EXISTS idx_managers_supabase_user_id
  ON managers (supabase_user_id);

-- messages: primary AI query path (last N messages for a conversation)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_client_id
  ON messages (client_id);
CREATE INDEX IF NOT EXISTS idx_messages_twilio_sid
  ON messages (twilio_sid) WHERE twilio_sid IS NOT NULL;

-- conversations
CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id
  ON conversations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_client_status
  ON conversations (client_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
  ON conversations (last_message_at DESC NULLS LAST);

-- units
CREATE INDEX IF NOT EXISTS idx_units_client_id
  ON units (client_id);

-- tickets
CREATE INDEX IF NOT EXISTS idx_tickets_client_status
  ON tickets (client_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_unit_id
  ON tickets (unit_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant_id
  ON tickets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_conversation_id
  ON tickets (conversation_id);

-- kb_chunks
CREATE INDEX IF NOT EXISTS idx_kb_chunks_document_id
  ON kb_chunks (document_id);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_client_id
  ON kb_chunks (client_id);

-- actions_log
CREATE INDEX IF NOT EXISTS idx_actions_log_conversation_id
  ON actions_log (conversation_id);
CREATE INDEX IF NOT EXISTS idx_actions_log_client_id
  ON actions_log (client_id);
