-- Migration 012: Property location fields — city, state, country, zip

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS city    TEXT,
  ADD COLUMN IF NOT EXISTS state   TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS zip     TEXT;
