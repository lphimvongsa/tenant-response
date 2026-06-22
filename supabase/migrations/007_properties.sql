-- Migration 007: Properties table — group units under named properties

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Create properties table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE properties (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID        NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  address    TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manager_access_own_properties"
  ON properties FOR ALL TO authenticated
  USING  (client_id = auth_client_id())
  WITH CHECK (client_id = auth_client_id());

CREATE INDEX idx_properties_client_id ON properties (client_id);

CREATE OR REPLACE TRIGGER trg_properties_updated_at
  BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add property_id to units
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE units ADD COLUMN property_id UUID REFERENCES properties (id) ON DELETE CASCADE;

CREATE INDEX idx_units_property_id ON units (property_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Data migration (Option A):
--    For each unique (client_id, address) in units, create one property record
--    using the address as both name and address, then link the units to it.
-- ─────────────────────────────────────────────────────────────────────────────
WITH inserted AS (
  INSERT INTO properties (client_id, name, address)
  SELECT DISTINCT client_id, address, address
  FROM   units
  WHERE  address IS NOT NULL
  RETURNING id, client_id, address
)
UPDATE units u
SET    property_id = i.id
FROM   inserted i
WHERE  u.client_id = i.client_id
  AND  u.address   = i.address;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Make units.address nullable — address is now canonical on properties
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE units ALTER COLUMN address DROP NOT NULL;
