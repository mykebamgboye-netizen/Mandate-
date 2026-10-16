-- 004: the living federation.
--
-- Four things land here:
--   1. the office catalogue (positions) — every seat the constitution creates, generated
--      from federation_states / federation_lgas rather than hand-listed
--   2. the fictional party system
--   3. the living cast: npcs, relationships, saves, events, media outlets
--   4. the century calendar, 2026–2126
--
-- The migration verifies itself: the DO block at the end raises an exception (and fails the
-- push) if any count does not match the catalogue the TypeScript engine builds in
-- src/sim/positions.ts and src/sim/calendar.ts. The engine's own tests assert the same
-- numbers. Both are the same arithmetic, so the database and the offline engine cannot drift
-- apart silently.
--
--   positions   10,192 total
--                 501 federal (President + VP + 30 Ministers + 109 Senators + 360 Reps)
--                 108 state   (36 Governors + 36 Deputies + 36 Speakers)
--                 774 local   (one Chairman per council)
--               8,809 ward    (the ward councillors)
--   the "day-one playable" slice the brief calls 1,247 is 1,245 as constituted:
--   President + VP + 109 Senators + 360 Reps + 774 Chairmen. The brief's figure needs
--   three senators for the FCT (37 × 3 = 111); s.48 gives the territory one.
--   calendar     108 cycles: 25 presidential + 50 state (25 rounds incl. the 8 off-cycle
--                states) + 33 council cycles.

-- ---------------------------------------------------------------------------
-- 1. the office catalogue
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS positions (
  id                 TEXT PRIMARY KEY,
  title              TEXT NOT NULL,
  tier               TEXT NOT NULL CHECK (tier IN ('federal','state','lga','ward')),
  arm                TEXT NOT NULL CHECK (arm IN ('executive','legislative','judicial','appointed')),
  jurisdiction       TEXT NOT NULL,
  state_code         TEXT REFERENCES federation_states(code) ON DELETE CASCADE,
  lga_code           TEXT REFERENCES federation_lgas(id) ON DELETE CASCADE,
  term_years         INT NOT NULL CHECK (term_years > 0),
  salary_monthly     BIGINT NOT NULL CHECK (salary_monthly >= 0),
  faac_share         NUMERIC NOT NULL DEFAULT 0,
  prerequisites      JSONB NOT NULL DEFAULT '[]',
  powers             JSONB NOT NULL DEFAULT '[]',
  appointment_type   TEXT NOT NULL CHECK (appointment_type IN ('elected','appointed','civil_service')),
  campaign_cost_naira BIGINT NOT NULL DEFAULT 0,
  -- every office is playable from day one in this build
  playable           BOOLEAN NOT NULL DEFAULT true,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_positions_tier ON positions(tier);
CREATE INDEX IF NOT EXISTS idx_positions_state ON positions(state_code);
CREATE INDEX IF NOT EXISTS idx_positions_lga ON positions(lga_code);

-- The catalogue is derived, not authored: clear and regenerate. Anything that needs to
-- survive a reseed should live in saves/events, not here.
DELETE FROM positions;

-- 1a. federal executive: President, Vice President, 30 Ministers
INSERT INTO positions (id, title, tier, arm, jurisdiction, term_years, salary_monthly, faac_share, powers, appointment_type, campaign_cost_naira)
SELECT v.id, v.title, 'federal', v.arm, v.jurisdiction, 4, v.salary, v.faac, v.powers, v.appointment_type, v.cost
FROM (VALUES
  ('federal/president','President','executive','Nigeria',1400000::bigint,0.52::numeric,
   '["sign.memo","appoint.minister","receive.faac","budget.allocate","command.convention"]'::jsonb,'elected',2500000000::bigint),
  ('federal/vice-president','Vice President','executive','Nigeria',1200000,0,
   '["sign.memo","preside.senate","receive.faac"]'::jsonb,'elected',2500000000)
) AS v(id, title, arm, jurisdiction, salary, faac, powers, appointment_type, cost);

INSERT INTO positions (id, title, tier, arm, jurisdiction, term_years, salary_monthly, prerequisites, powers, appointment_type, campaign_cost_naira)
SELECT 'federal/minister/' || lower(regexp_replace(dept, '[^a-zA-Z0-9]+', '-', 'g')),
       'Minister of ' || dept, 'federal', 'appointed', 'Ministry of ' || dept,
       4, 950000, '[{"kind":"party-role"}]'::jsonb,
       '["propose.memo","allocate.ministry","receive.appropriation"]'::jsonb,
       'appointed', 1200000000
FROM unnest(ARRAY[
  'Finance','Works','Education','Health','Defence','Interior','Justice',
  'Agriculture','Petroleum','Power','Transport','Aviation','Communications',
  'Environment','Water Resources','Youth','Women Affairs','Labour','Trade',
  'Science and Technology','Housing','Police Affairs','Federal Capital Territory',
  'Special Duties','Budget and Planning','Humanitarian Affairs','Steel Development',
  'Blue Economy','Tourism','Sports Development'
]) AS dept;

-- 1b. National Assembly: three senators per state, one for the FCT (s.48); 360 Reps (s.49)
INSERT INTO positions (id, title, tier, arm, jurisdiction, state_code, term_years, salary_monthly, powers, appointment_type, campaign_cost_naira)
SELECT 'federal/senator/' || s.code || '/' || lower(w.wing),
       'Senator', 'federal', 'legislative', s.name || ' ' || w.wing || ' Senatorial District',
       s.code, 4, 1100000,
       '["legislate","oversight","budget.scrutinize","receive.constituency"]'::jsonb,
       'elected', 400000000
FROM federation_states s
CROSS JOIN (VALUES ('Central'),('North'),('South')) AS w(wing)
WHERE s.code <> 'FC';

INSERT INTO positions (id, title, tier, arm, jurisdiction, state_code, term_years, salary_monthly, powers, appointment_type, campaign_cost_naira)
VALUES ('federal/senator/FC','Senator','federal','legislative','FCT Senatorial District','FC',4,1100000,
        '["legislate","oversight","budget.scrutinize","receive.constituency"]'::jsonb,'elected',400000000);

-- House seats per state (the constitution's 360-member House)
INSERT INTO positions (id, title, tier, arm, jurisdiction, state_code, term_years, salary_monthly, powers, appointment_type, campaign_cost_naira)
SELECT 'federal/rep/' || r.state_code || '/' || n,
       'Hon. Member, House of Reps', 'federal', 'legislative',
       s.name || ' Federal Constituency ' || n, r.state_code, 4, 950000,
       '["legislate","oversight","budget.scrutinize","receive.constituency"]'::jsonb,
       'elected', 400000000
FROM (VALUES
  ('AB',8),('AD',8),('AK',10),('AN',11),('BA',12),('BY',5),('BE',11),('BO',10),('CR',8),('DT',10),
  ('EB',6),('ED',9),('EK',6),('EN',8),('FC',2),('GO',6),('IM',10),('JI',11),('KD',16),('KN',24),
  ('KT',15),('KE',8),('KO',9),('KW',6),('LA',24),('NA',5),('NI',10),('OG',9),('ON',9),('OS',9),
  ('OY',14),('PL',8),('RI',13),('SO',11),('TA',6),('YO',6),('ZA',7)
) AS r(state_code, seats)
JOIN federation_states s ON s.code = r.state_code
CROSS JOIN LATERAL generate_series(1, r.seats) AS n;

-- 1c. the states: 36 governorships (the FCT has none — s.299), deputies and speakers
INSERT INTO positions (id, title, tier, arm, jurisdiction, state_code, term_years, salary_monthly, faac_share, prerequisites, powers, appointment_type, campaign_cost_naira)
SELECT 'state/' || s.code || '/governor', 'Governor', 'state', 'executive', s.name, s.code, 4, 1000000, 0.26,
       jsonb_build_array(jsonb_build_object('kind','terms','officeId','federal/senator/' || s.code || '/central','minTerms',1)),
       '["sign.memo","appoint.commissioner","receive.faac","budget.allocate","deploy.request","oversight.lga"]'::jsonb,
       'elected', 900000000
FROM federation_states s WHERE s.code <> 'FC';

INSERT INTO positions (id, title, tier, arm, jurisdiction, state_code, term_years, salary_monthly, powers, appointment_type, campaign_cost_naira)
SELECT 'state/' || s.code || '/deputy-governor', 'Deputy Governor', 'state', 'executive', s.name, s.code, 4, 900000,
       '["sign.memo","receive.faac","budget.allocate"]'::jsonb, 'elected', 900000000
FROM federation_states s WHERE s.code <> 'FC';

INSERT INTO positions (id, title, tier, arm, jurisdiction, state_code, term_years, salary_monthly, prerequisites, powers, appointment_type, campaign_cost_naira)
SELECT 'state/' || s.code || '/speaker', 'Speaker, State House of Assembly', 'state', 'legislative',
       s.name || ' State House of Assembly', s.code, 4, 600000,
       jsonb_build_array(jsonb_build_object('kind','office','officeId','state/' || s.code || '/assembly','minTerms',1)),
       '["preside.house","certify.legislation","oversight","receive.faac"]'::jsonb,
       'elected', 120000000
FROM federation_states s WHERE s.code <> 'FC';

-- 1d. the third tier: one chairman per council, and the wards
INSERT INTO positions (id, title, tier, arm, jurisdiction, state_code, lga_code, term_years, salary_monthly, faac_share, powers, appointment_type, campaign_cost_naira)
SELECT 'lga/' || l.id || '/chairman', 'Chairman, Local Government', 'lga', 'executive',
       l.name || ' LGA, ' || s.name, l.state_code, l.id, 3, 350000, 0.20,
       '["allocate.lga","receive.lga","propose.memo","oversight.ward"]'::jsonb,
       'elected', 40000000
FROM federation_lgas l
JOIN federation_states s ON s.code = l.state_code;

-- 8,809 wards. The national ward count is fixed by the register; INEC's own per-council
-- breakdown is not reproduced, so the split is deterministic and exact: the first 295
-- councils (in id order) carry 12 wards and the remaining 479 carry 11 → 8,809.
WITH ranked AS (
  SELECT id, state_code, row_number() OVER (ORDER BY id) - 1 AS rn
  FROM federation_lgas
),
per_lga AS (
  SELECT id, state_code, rn, CASE WHEN rn < 295 THEN 12 ELSE 11 END AS wards
  FROM ranked
)
INSERT INTO positions (id, title, tier, arm, jurisdiction, state_code, lga_code, term_years, salary_monthly, powers, appointment_type, campaign_cost_naira)
SELECT 'ward/' || p.id || '/' || w || '/councillor', 'Councillor', 'ward', 'legislative',
       split_part(p.id, '/', 2) || ' Ward ' || w, p.state_code, p.id, 3, 150000,
       '["legislate.lga","oversight.ward","receive.constituency"]'::jsonb,
       'elected', 3000000
FROM per_lga p
CROSS JOIN LATERAL generate_series(1, p.wards) AS w;

-- The office catalogue in federation_offices stays the constitutional reference set, but
-- the four-office play limit is dropped: the picker reads positions, and every office is
-- playable from day one.
UPDATE federation_offices SET playable = true;

-- ---------------------------------------------------------------------------
-- 2. the fictional party system
-- ---------------------------------------------------------------------------

ALTER TABLE federation_parties ADD COLUMN IF NOT EXISTS symbol TEXT NOT NULL DEFAULT '';
ALTER TABLE federation_parties ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT '';
ALTER TABLE federation_parties ADD COLUMN IF NOT EXISTS colour_hex TEXT NOT NULL DEFAULT '#888888';
ALTER TABLE federation_parties ADD COLUMN IF NOT EXISTS founded INT;
ALTER TABLE federation_parties ADD COLUMN IF NOT EXISTS base_zones TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE federation_parties ADD COLUMN IF NOT EXISTS godfather_tolerance_bp INT NOT NULL DEFAULT 5000
  CHECK (godfather_tolerance_bp BETWEEN 0 AND 10000);
ALTER TABLE federation_parties ADD COLUMN IF NOT EXISTS ideology JSONB NOT NULL DEFAULT '{}';

-- The federation's parties are fictional. The eight below mirror src/sim/parties.ts exactly;
-- factions, founding crises and split histories are generated per seed at runtime.
DELETE FROM federation_parties;
INSERT INTO federation_parties (code, name, note, symbol, colour, colour_hex, founded, base_zones, godfather_tolerance_bp, ideology)
VALUES
('PA','Progressive Alliance','The largest machine; born of a merger of three clubs.','broom','green','#1c7a3e',1998,'{SW,NW,NC}',8500,'{"patronage":8200,"reform":3000,"regionalism":4500}'::jsonb),
('PDM','People''s Democratic Movement','South-south governors bankrolled it and then argued over it.','umbrella','red','#b0212b',1999,'{SS,SE,NC}',8000,'{"patronage":7800,"reform":3500,"regionalism":6200}'::jsonb),
('LRP','Labour Reform Party','A wage strike that became a party.','family','gold','#c8951d',2002,'{SW,SS,SE}',2500,'{"patronage":2600,"reform":8800,"regionalism":2400}'::jsonb),
('NCP','National Consensus Party','The northern establishment, registered twice.','scale','blue','#1d3f8f',1995,'{NW,NE,NC}',7500,'{"patronage":7200,"reform":4000,"regionalism":7000}'::jsonb),
('ADC','Action Democratic Congress','A donors'' forum with a manifesto and no ward offices.','torch','orange','#c25a12',2005,'{SW,NC,SS}',4500,'{"patronage":4200,"reform":7000,"regionalism":3200}'::jsonb),
('APF','Allied Peoples Front','Assembled in six weeks out of defectors.','handshake','purple','#6a2f86',2010,'{NC,NE,SS}',9000,'{"patronage":8400,"reform":2200,"regionalism":5000}'::jsonb),
('NNI','New Nigeria Initiative','A register of four million members nobody can find.','star','white','#8c8c94',2018,'{SW,SE,SS}',1500,'{"patronage":1800,"reform":9200,"regionalism":2800}'::jsonb),
('UPP','United Progressive People','A market association that expected a chairman.','palm','teal','#137a76',2012,'{SE,SS}',6000,'{"patronage":5800,"reform":5200,"regionalism":7400}'::jsonb);

-- ---------------------------------------------------------------------------
-- 3. the living cast
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS npcs (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  given_name     TEXT NOT NULL DEFAULT '',
  family_name    TEXT NOT NULL DEFAULT '',
  initials       TEXT NOT NULL DEFAULT '',
  title          TEXT,
  gender         TEXT CHECK (gender IN ('f','m')),
  born           INT NOT NULL,
  home_state     TEXT REFERENCES federation_states(code),
  zone           TEXT,
  position_id    TEXT REFERENCES positions(id) ON DELETE SET NULL,
  party_code     TEXT REFERENCES federation_parties(code),
  faction        TEXT,
  ambition       JSONB,
  axes           JSONB NOT NULL DEFAULT '{}',
  bank           BIGINT NOT NULL DEFAULT 0,
  traits         TEXT[] NOT NULL DEFAULT '{}',
  history        JSONB NOT NULL DEFAULT '[]',
  is_alive       BOOLEAN NOT NULL DEFAULT true,
  terms_served   SMALLINT NOT NULL DEFAULT 0,
  last_candidacy_date DATE,
  last_action_date DATE,
  departed_at    TIMESTAMPTZ,
  is_key         BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_npcs_position ON npcs(position_id);
CREATE INDEX IF NOT EXISTS idx_npcs_party ON npcs(party_code);
CREATE INDEX IF NOT EXISTS idx_npcs_state ON npcs(home_state);

CREATE TABLE IF NOT EXISTS relationships (
  actor_id       TEXT NOT NULL,   -- a save id ('player:<uuid>') or an npc id
  npc_id         TEXT NOT NULL REFERENCES npcs(id) ON DELETE CASCADE,
  trust          SMALLINT NOT NULL DEFAULT 0 CHECK (trust BETWEEN -100 AND 100),
  debt           BIGINT NOT NULL DEFAULT 0,
  they_owe_you   BIGINT NOT NULL DEFAULT 0,
  blackmail      JSONB,
  shared_secrets SMALLINT NOT NULL DEFAULT 0,
  last_interaction DATE,
  interaction_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (actor_id, npc_id)
);

CREATE TABLE IF NOT EXISTS saves (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  player_name        TEXT NOT NULL,
  start_date         DATE NOT NULL DEFAULT '2026-01-01',
  -- current_date is a reserved word in Postgres, hence date_current
  date_current       DATE NOT NULL DEFAULT '2026-01-01',
  position_id        TEXT REFERENCES positions(id) ON DELETE SET NULL,
  party_code         TEXT REFERENCES federation_parties(code),
  axes               JSONB NOT NULL DEFAULT '{}',
  bank               BIGINT NOT NULL DEFAULT 0,
  history            JSONB NOT NULL DEFAULT '[]',
  is_unemployed      BOOLEAN NOT NULL DEFAULT false,
  unemployment_start DATE,
  retired_at         DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saves_profile ON saves(profile_id);

CREATE TABLE IF NOT EXISTS media_outlets (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  owner_npc_id    TEXT REFERENCES npcs(id) ON DELETE SET NULL,
  reach_thousands INT NOT NULL DEFAULT 0,
  bias            JSONB NOT NULL DEFAULT '{}',   -- party code → -100..100
  price_per_story BIGINT NOT NULL DEFAULT 0,
  syndication_bp  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS events (
  id             TEXT PRIMARY KEY,
  save_id        UUID REFERENCES saves(id) ON DELETE CASCADE,
  week_date      DATE NOT NULL,
  template_id    TEXT NOT NULL,
  tier           TEXT NOT NULL,
  actor_npc_id   TEXT REFERENCES npcs(id) ON DELETE SET NULL,
  target_position_id TEXT REFERENCES positions(id) ON DELETE SET NULL,
  context        JSONB NOT NULL DEFAULT '{}',
  options        JSONB NOT NULL DEFAULT '[]',
  resolved       BOOLEAN NOT NULL DEFAULT false,
  outcome        JSONB
);

CREATE INDEX IF NOT EXISTS idx_events_save ON events(save_id, week_date);

-- The press: twelve fictional mastheads. Bias/reach are authoritative in
-- src/sim/media.ts (generated per seed); this seeds the roster so the desk has a market
-- to read before the first week has been run.
INSERT INTO media_outlets (id, name, reach_thousands, price_per_story)
VALUES
('media/1-the-gazette','The Gazette',1800,40000000),
('media/2-sapele-times','Sapele Times',450,8000000),
('media/3-the-national-ledger','The National Ledger',1200,30000000),
('media/4-continental-monitor','Continental Monitor',900,25000000),
('media/5-the-daily-marker','The Daily Marker',1500,35000000),
('media/6-northern-star','Northern Star',700,18000000),
('media/7-delta-dispatch','Delta Dispatch',300,5000000),
('media/8-the-republic','The Republic',1100,28000000),
('media/9-ward-and-country','Ward & Country',200,3000000),
('media/10-the-capital-post','The Capital Post',1000,26000000),
('media/11-first-draft','First Draft',600,14000000),
('media/12-the-evening-broom','The Evening Broom',1600,38000000)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  reach_thousands = EXCLUDED.reach_thousands,
  price_per_story = EXCLUDED.price_per_story;

-- ---------------------------------------------------------------------------
-- 4. the century calendar, 2026–2126
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS calendar (
  id            TEXT PRIMARY KEY,
  cycle_kind    TEXT NOT NULL CHECK (cycle_kind IN ('presidential','state','lga')),
  year          INT NOT NULL,
  date          DATE NOT NULL,
  primary_opens DATE NOT NULL,
  label         TEXT NOT NULL,
  jurisdiction  TEXT NOT NULL,
  offices_up    INT NOT NULL DEFAULT 0
);

DELETE FROM calendar;

-- Third Saturday of a month: 1 + ((6 − dow(first) + 7) mod 7) + 14, dow: 0 = Sunday.
CREATE OR REPLACE FUNCTION third_saturday(y INT, m INT) RETURNS DATE
LANGUAGE sql IMMUTABLE AS $$
  SELECT (make_date(y, m, 1) + (((6 - EXTRACT(DOW FROM make_date(y, m, 1))::int + 7) % 7) + 14))
$$;

-- presidential + the general governorship round: years ≡ 3 (mod 4)
INSERT INTO calendar (id, cycle_kind, year, date, primary_opens, label, jurisdiction, offices_up)
SELECT 'presidential/' || y, 'presidential', y, third_saturday(y, 2), third_saturday(y, 2) - 90,
       y || ' — presidential election', 'Nigeria', 2
FROM generate_series(2026, 2126) AS y
WHERE y % 4 = 3;

INSERT INTO calendar (id, cycle_kind, year, date, primary_opens, label, jurisdiction, offices_up)
SELECT 'state/' || y, 'state', y, third_saturday(y, 2), third_saturday(y, 2) - 90,
       y || ' — 28 governorship contests', '28 states (general cycle)', 56
FROM generate_series(2026, 2126) AS y
WHERE y % 4 = 3;

-- the eight off-cycle states: years ≡ 1 (mod 4), November
INSERT INTO calendar (id, cycle_kind, year, date, primary_opens, label, jurisdiction, offices_up)
SELECT 'state/off-cycle/' || y, 'state', y, third_saturday(y, 11), third_saturday(y, 11) - 90,
       y || ' — 8 off-cycle governorship contests', '8 off-cycle states', 16
FROM generate_series(2026, 2126) AS y
WHERE y % 4 = 1;

-- council elections every three years, anchored at 2027 and capped at 2123 (33 cycles)
INSERT INTO calendar (id, cycle_kind, year, date, primary_opens, label, jurisdiction, offices_up)
SELECT 'lga/' || y, 'lga', y, third_saturday(y, 5), third_saturday(y, 5) - 90,
       y || ' — 774 council contests', '774 local government councils', 774
FROM generate_series(2027, 2123, 3) AS y;

CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar(date);

-- ---------------------------------------------------------------------------
-- 4b. row-level security (after every table exists)
-- ---------------------------------------------------------------------------

ALTER TABLE npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'positions' AND policyname = 'fed_read') THEN
    CREATE POLICY fed_read ON positions FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'calendar' AND policyname = 'fed_read') THEN
    CREATE POLICY fed_read ON calendar FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'npcs' AND policyname = 'fed_read') THEN
    CREATE POLICY fed_read ON npcs FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'relationships' AND policyname = 'rel_own') THEN
    CREATE POLICY rel_own ON relationships FOR ALL
      USING (actor_id = 'player:' || auth.uid()::text)
      WITH CHECK (actor_id = 'player:' || auth.uid()::text);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'saves' AND policyname = 'saves_own') THEN
    CREATE POLICY saves_own ON saves FOR ALL
      USING (profile_id = auth.uid())
      WITH CHECK (profile_id = auth.uid());
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. self-verification: the migration fails if the catalogue is not exact
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  total INT; core INT; senators INT; reps INT; governors INT; ministers INT;
  chairmen INT; councillors INT; deputies INT; speakers INT; cycles INT; cal_lga INT;
BEGIN
  SELECT count(*) INTO total FROM positions;
  SELECT count(*) INTO core FROM positions
    WHERE id IN ('federal/president','federal/vice-president')
       OR id LIKE 'federal/senator/%' OR id LIKE 'federal/rep/%' OR id LIKE 'lga/%/chairman';
  SELECT count(*) INTO senators FROM positions WHERE id LIKE 'federal/senator/%';
  SELECT count(*) INTO reps FROM positions WHERE id LIKE 'federal/rep/%';
  SELECT count(*) INTO governors FROM positions WHERE id LIKE 'state/%/governor';
  SELECT count(*) INTO deputies FROM positions WHERE id LIKE 'state/%/deputy-governor';
  SELECT count(*) INTO speakers FROM positions WHERE id LIKE 'state/%/speaker';
  SELECT count(*) INTO ministers FROM positions WHERE id LIKE 'federal/minister/%';
  SELECT count(*) INTO chairmen FROM positions WHERE id LIKE 'lga/%/chairman';
  SELECT count(*) INTO councillors FROM positions WHERE id LIKE 'ward/%/councillor';
  SELECT count(*) INTO cycles FROM calendar;
  SELECT count(*) INTO cal_lga FROM calendar WHERE cycle_kind = 'lga';

  IF total <> 10192 THEN RAISE EXCEPTION 'positions: expected 10192, found %', total; END IF;
  IF core <> 1245 THEN RAISE EXCEPTION 'playable core: expected 1245, found %', core; END IF;
  IF senators <> 109 THEN RAISE EXCEPTION 'senators: expected 109, found %', senators; END IF;
  IF reps <> 360 THEN RAISE EXCEPTION 'reps: expected 360, found %', reps; END IF;
  IF governors <> 36 THEN RAISE EXCEPTION 'governors: expected 36, found %', governors; END IF;
  IF deputies <> 36 THEN RAISE EXCEPTION 'deputies: expected 36, found %', deputies; END IF;
  IF speakers <> 36 THEN RAISE EXCEPTION 'speakers: expected 36, found %', speakers; END IF;
  IF ministers <> 30 THEN RAISE EXCEPTION 'ministers: expected 30, found %', ministers; END IF;
  IF chairmen <> 774 THEN RAISE EXCEPTION 'chairmen: expected 774, found %', chairmen; END IF;
  IF councillors <> 8809 THEN RAISE EXCEPTION 'councillors: expected 8809, found %', councillors; END IF;
  IF cycles <> 108 THEN RAISE EXCEPTION 'calendar cycles: expected 108, found %', cycles; END IF;
  IF cal_lga <> 33 THEN RAISE EXCEPTION 'council cycles: expected 33, found %', cal_lga; END IF;

  RAISE NOTICE 'living federation seeded: % positions (% playable core), % calendar cycles',
    total, core, cycles;
END $$;
