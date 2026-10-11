-- seed 001f: scenario start state — Delta tutorial (wired from src/content.ts anchors)
INSERT INTO scenario_start_state (scenario_id, title, office_id, state_code, seed)
VALUES ('delta/2026/w41','Situation Desk — Delta, 8 Oct 2026','state/governor','DT',0xc0ffee::bigint)
ON CONFLICT DO NOTHING;
