#!/usr/bin/env bash
# Apply the MANDATE profile + federation reference schema and seed to the live project.
# This script is run once, by the project owner / a setup agent, with the access token in
# SUPABASE_ACCESS_TOKEN. It does NOT echo any secret. It writes progress to stdout only.

set -euo pipefail

PROJECT_URL="${SUPABASE_PROJECT_URL:-https://eechinfurzvfinobuyyg.supabase.co}"
TOKEN="${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN}"

BASE="https://${PROJECT_URL}/rest/v1"
INFOSCHEMA="https://${PROJECT_URL}/rest/v1/information_schema"

echo "==> probing project shape (read-only) at ${PROJECT_URL}"

# List existing tables in the public schema
echo "--- existing tables in public ---"
curl -s -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  "${INFOSCHEMA}.tables?table_schema=public&format=json" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('\n'.join(r['table_name'] for r in d))" \
  || echo "(could not list tables — project may need the token to have the right scope)"

echo "==> applying migration 001_profile_federation_setup.sql"
curl -s -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/sql" \
  --data-binary @supabase/migrations/001_profile_federation_setup.sql \
  "${BASE}/pglte?mode=apply" \
  | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" \
  || echo "(migration apply returned non-zero — inspect above)"

echo "==> applying seed 001a (states + FCT)"
curl -s -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/sql" \
  --data-binary @/tmp/seed_001a.sql \
  "${BASE}/pglte?mode=apply" \
  | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" \
  || echo "(seed 001a returned non-zero — inspect above)"

echo "==> applying seed 001b (LGAs, part 1 of 2)"
curl -s -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/sql" \
  --data-binary @/tmp/seed_001b.sql \
  "${BASE}/pglte?mode=apply" \
  | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" \
  || echo "(seed 001b returned non-zero — inspect above)"

echo "==> applying seed 001c (LGAs, part 2 of 2)"
curl -s -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/sql" \
  --data-binary @/tmp/seed_001c.sql \
  "${BASE}/pglte?mode=apply" \
  | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" \
  || echo "(seed 001c returned non-zero — inspect above)"

echo "==> applying seed 001d (parties)"
curl -s -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/sql" \
  --data-binary @/tmp/seed_001d.sql \
  "${BASE}/pglte?mode=apply" \
  | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" \
  || echo "(seed 001d returned non-zero — inspect above)"

echo "==> applying seed 001e (offices)"
curl -s -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/sql" \
  --data-binary @/tmp/seed_001e.sql \
  "${BASE}/pglte?mode=apply" \
  | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" \
  || echo "(seed 001e returned non-zero — inspect above)"

echo "==> applying seed 001f (Delta tutorial scenario row)"
curl -s -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/sql" \
  --data-binary @/tmp/seed_001f.sql \
  "${BASE}/pglte?mode=apply" \
  | python3 -c "import sys,json; print(json.dumps(json.load(sys.stdin), indent=2))" \
  || echo "(seed 001f returned non-zero — inspect above)"

echo "==> done"
