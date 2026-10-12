-- MANDATE — profile + federation reference schema (part 1: tables + RLS)
-- Run once per project with the service_role key.
-- Reference data (states, LGAs, parties, offices, scenario row) is seeded in the
-- companion seed files so this migration stays readable. The seed files are the
-- canonical source of truth for the federation reference set.
CREATE TABLE IF NOT EXISTS federation_states (
  code            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  capital         TEXT NOT NULL,
  tier            TEXT NOT NULL DEFAULT 'state',
  zone            TEXT,
  senatorial_districts TEXT[]
);
CREATE TABLE IF NOT EXISTS federation_lgas (
  id              TEXT PRIMARY KEY,
  state_code      TEXT NOT NULL REFERENCES federation_states(code) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  fiscal_note     TEXT NOT NULL DEFAULT 'Residual tier under the constitution; fiscal autonomy contested in practice.'
);
CREATE TABLE IF NOT EXISTS federation_parties (
  code            TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  note            TEXT NOT NULL DEFAULT 'INEC-registered political party (cycle as supplied).'
);
CREATE TABLE IF NOT EXISTS federation_offices (
  id              TEXT PRIMARY KEY,
  tier            TEXT NOT NULL CHECK (tier IN ('federal','state','local','party')),
  post            TEXT NOT NULL,
  route           TEXT NOT NULL CHECK (route IN ('elected','appointed','nomination')),
  jurisdiction    TEXT NOT NULL,
  term_note       TEXT NOT NULL DEFAULT '',
  powers          JSONB NOT NULL DEFAULT '[]',
  revenue_map     JSONB NOT NULL DEFAULT '{}',
  authority_note  TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS patronage_network (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL,
  loyalty         SMALLINT NOT NULL DEFAULT 3 CHECK (loyalty BETWEEN 1 AND 5),
  note            TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profile_axis_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL,
  axis            TEXT NOT NULL,
  value_bp        SMALLINT NOT NULL,
  event_type      TEXT NOT NULL,
  source          TEXT,
  week            SMALLINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scenario_start_state (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id     TEXT NOT NULL,
  title           TEXT NOT NULL,
  office_id       TEXT NOT NULL,
  state_code      TEXT NOT NULL REFERENCES federation_states(code),
  seed            BIGINT NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  identity        JSONB NOT NULL DEFAULT '{}',
  office          JSONB NOT NULL DEFAULT '{}',
  party           JSONB NOT NULL DEFAULT '{}',
  axes            JSONB NOT NULL DEFAULT '{}',
  powers          TEXT[] NOT NULL DEFAULT ARRAY[]::text[],
  patronage_bank  BIGINT NOT NULL DEFAULT 0,
  deleted_at      TIMESTAMPTZ
);
CREATE OR REPLACE VIEW profiles_active AS
  SELECT * FROM profiles WHERE deleted_at IS NULL;
ALTER TABLE federation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE federation_lgas ENABLE ROW LEVEL SECURITY;
ALTER TABLE federation_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE federation_offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE patronage_network ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_axis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenario_start_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY fed_read ON federation_states FOR SELECT USING (true);
CREATE POLICY fed_read ON federation_lgas FOR SELECT USING (true);
CREATE POLICY fed_read ON federation_parties FOR SELECT USING (true);
CREATE POLICY fed_read ON federation_offices FOR SELECT USING (true);
CREATE POLICY profile_own_read ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY profile_own_write ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY patronage_own_read ON patronage_network FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = profile_id AND id = auth.uid()));
CREATE POLICY patronage_own_write ON patronage_network FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = profile_id AND id = auth.uid()));
CREATE POLICY axis_own_read ON profile_axis_history FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = profile_id AND id = auth.uid()));
CREATE POLICY axis_own_write ON profile_axis_history FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = profile_id AND id = auth.uid()));
CREATE POLICY scenario_read ON scenario_start_state FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_patronage_profile ON patronage_network(profile_id);
CREATE INDEX IF NOT EXISTS idx_axis_profile ON profile_axis_history(profile_id, axis);
CREATE INDEX IF NOT EXISTS idx_lgas_state ON federation_lgas(state_code);

-- Scenario rows must be unique per scenario_id. The original seed used a bare
-- `ON CONFLICT DO NOTHING`, which cannot fire against the surrogate `id` primary
-- key, so every seed run appended another identical row. A duplicate makes
-- PostgREST `.single()` fail with PGRST116 ("The result contains 2 rows"), which
-- the client used to read as "scenario not found" — a silent fallback, not an
-- error. Deduplicate first (keep the earliest row), then enforce uniqueness so
-- future seeds conflict on scenario_id as intended.
DELETE FROM scenario_start_state
WHERE id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY scenario_id ORDER BY started_at, id) AS rn
    FROM scenario_start_state
  ) ranked
  WHERE ranked.rn > 1
);
CREATE UNIQUE INDEX IF NOT EXISTS scenario_start_state_scenario_id_key
  ON scenario_start_state(scenario_id);
