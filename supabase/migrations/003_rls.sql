-- Enable RLS on every table. The service role key (used by the backend)
-- bypasses RLS; these policies protect dashboard users (authenticated role).

ALTER TABLE clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE units         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE managers      ENABLE ROW LEVEL SECURITY;

-- Helper: resolve the client_id for the currently authenticated dashboard user
CREATE OR REPLACE FUNCTION auth_client_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT client_id FROM managers WHERE supabase_user_id = auth.uid() LIMIT 1;
$$;

-- clients: managers can read their own client record only
CREATE POLICY "manager_read_own_client"
  ON clients FOR SELECT TO authenticated
  USING (id = auth_client_id());

-- units
CREATE POLICY "manager_access_own_units"
  ON units FOR ALL TO authenticated
  USING (client_id = auth_client_id())
  WITH CHECK (client_id = auth_client_id());

-- tenants
CREATE POLICY "manager_access_own_tenants"
  ON tenants FOR ALL TO authenticated
  USING (client_id = auth_client_id())
  WITH CHECK (client_id = auth_client_id());

-- conversations
CREATE POLICY "manager_access_own_conversations"
  ON conversations FOR ALL TO authenticated
  USING (client_id = auth_client_id())
  WITH CHECK (client_id = auth_client_id());

-- messages
CREATE POLICY "manager_access_own_messages"
  ON messages FOR ALL TO authenticated
  USING (client_id = auth_client_id())
  WITH CHECK (client_id = auth_client_id());

-- tickets
CREATE POLICY "manager_access_own_tickets"
  ON tickets FOR ALL TO authenticated
  USING (client_id = auth_client_id())
  WITH CHECK (client_id = auth_client_id());

-- kb_documents
CREATE POLICY "manager_access_own_kb_documents"
  ON kb_documents FOR ALL TO authenticated
  USING (client_id = auth_client_id())
  WITH CHECK (client_id = auth_client_id());

-- kb_chunks
CREATE POLICY "manager_access_own_kb_chunks"
  ON kb_chunks FOR ALL TO authenticated
  USING (client_id = auth_client_id())
  WITH CHECK (client_id = auth_client_id());

-- actions_log (read-only for managers — writes come from the backend service role)
CREATE POLICY "manager_read_own_actions_log"
  ON actions_log FOR SELECT TO authenticated
  USING (client_id = auth_client_id());

-- managers: users can only see their own row
CREATE POLICY "manager_read_own_row"
  ON managers FOR SELECT TO authenticated
  USING (supabase_user_id = auth.uid());
