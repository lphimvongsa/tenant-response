-- Root tenant: every other table hangs off this via client_id
CREATE TABLE clients (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  twilio_number      TEXT NOT NULL UNIQUE,
  escalation_contact TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE units (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  address     TEXT NOT NULL,
  unit_number TEXT NOT NULL
);

CREATE TABLE tenants (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  unit_id   UUID REFERENCES units (id) ON DELETE SET NULL,
  phone     TEXT NOT NULL UNIQUE,
  name      TEXT
);

CREATE TABLE conversations (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  channel   TEXT NOT NULL DEFAULT 'sms',
  status    TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  direction       TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  unit_id     UUID REFERENCES units (id) ON DELETE SET NULL,
  category    TEXT,
  severity    TEXT,
  status      TEXT NOT NULL DEFAULT 'open',
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE kb_documents (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  source    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 1536 dimensions matches OpenAI text-embedding-3-small
CREATE TABLE kb_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES kb_documents (id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  embedding   VECTOR(1536)
);

CREATE INDEX ON kb_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE actions_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations (id) ON DELETE SET NULL,
  tool            TEXT NOT NULL,
  args            JSONB,
  result          JSONB,
  approved_by     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Dashboard users; supabase_user_id links to Supabase Auth
CREATE TABLE managers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  supabase_user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role             TEXT NOT NULL DEFAULT 'manager',
  UNIQUE (supabase_user_id)
);
