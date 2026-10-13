-- 002: the FCT is not a state — it has no governorship.
--
-- The onboarding picker offered all 36 states + FCT but pinned every choice to
-- 'state/governor', so picking the FCT produced "Governor of FCT" /
-- "STATE GOVERNMENT · Governor · ELECTED", which is constitutionally wrong: the
-- Federal Capital Territory is administered by the President through a Minister
-- (s.299), not by an elected Governor.
--
-- Two things are needed: the tier CHECK must admit an 'fct' tier, and the office
-- itself must exist so the picker can route the FCT card to it.

-- 1) admit tier = 'fct'
ALTER TABLE federation_offices DROP CONSTRAINT IF EXISTS federation_offices_tier_check;
ALTER TABLE federation_offices ADD CONSTRAINT federation_offices_tier_check
  CHECK (tier IN ('federal','state','local','party','fct'));

-- 2) the office: appointed, not elected; powers scoped to an administrator
INSERT INTO federation_offices (id, tier, post, route, jurisdiction, term_note, powers, revenue_map, authority_note)
VALUES (
  'fct/minister',
  'fct',
  'Minister of the Federal Capital Territory',
  'appointed',
  'territory',
  'Serves at the pleasure of the President; no elected governorship exists for the territory.',
  '["sign.memo","receive.faac","receive.appropriation","budget.allocate","oversight.lga"]',
  '{"faac_net":true,"igr":true,"state_wages":true,"state_capex":true}',
  's.299 · FCT administered by the President through a Minister'
)
ON CONFLICT (id) DO UPDATE SET
  tier           = EXCLUDED.tier,
  post           = EXCLUDED.post,
  route          = EXCLUDED.route,
  jurisdiction   = EXCLUDED.jurisdiction,
  term_note      = EXCLUDED.term_note,
  powers         = EXCLUDED.powers,
  revenue_map    = EXCLUDED.revenue_map,
  authority_note = EXCLUDED.authority_note;
