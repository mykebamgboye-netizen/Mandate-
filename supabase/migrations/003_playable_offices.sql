-- 003: which offices a player may take at first-open.
--
-- The catalogue in federation_offices is the constitutional reference set (27 rows across
-- federal/state/local/party/fct). Only a curated subset is playable from the post picker, so
-- the catalogue stays the source of truth for powers/revenue/jurisdiction while the game
-- decides what it currently offers.
ALTER TABLE federation_offices ADD COLUMN IF NOT EXISTS playable BOOLEAN NOT NULL DEFAULT false;

-- The playable set: one elected executive per tier, plus the FCT's appointed administrator.
--   federal/president  — the Federation
--   state/governor     — the 36 states (the FCT has no governorship: s.299)
--   fct/minister       — the Federal Capital Territory, appointed by the President
--   local/chairman     — the 774 LGAs
UPDATE federation_offices SET playable = true
 WHERE id IN ('federal/president','state/governor','fct/minister','local/chairman');

-- everything else remains catalogue-only (readable, not offered)
UPDATE federation_offices SET playable = false
 WHERE id NOT IN ('federal/president','state/governor','fct/minister','local/chairman');
