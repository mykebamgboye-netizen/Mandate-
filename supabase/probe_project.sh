#!/usr/bin/env bash
# Read-only probe of the live Supabase project. Never prints secrets.
set -euo pipefail

PROJECT_REF="eechinfurzvfinobuyyg"
PROJECT_URL="https://${PROJECT_REF}.supabase.co"
CREDS_FILE="/tmp/supabase_creds.txt"

if [ ! -f "$CREDS_FILE" ]; then
  echo "abort: $CREDS_FILE not found — write ACCESS_TOKEN and DB_PASSWORD there first"
  exit 1
fi

ACCESS_TOKEN="$(sed -n '1p' "$CREDS_FILE")"
DB_PASSWORD="$(sed -n '2p' "$CREDS_FILE")"

: "${ACCESS_TOKEN:?abort: no access token in $CREDS_FILE}"

MGMT="https://api.supabase.com/v1/projects/${PROJECT_REF}"

redact_output() {
  sed -E \
    -e 's/[A-Za-z0-9+/=]{20,}/<TOKEN_REDACTED>/g' \
    -e "s/${DB_PASSWORD}/<DB_PASSWORD_REDACTED>/g" \
    -e "s/eechinfurzvfinobuyyg/<PROJECT_REF>/g" \
  | sed -n '1,300p'
}

echo "==> probing project shape (read-only) at ${PROJECT_URL}"

echo "--- existing tables in public (via Management API read-only query) ---"
curl --fail-with-body -sS \
  "${MGMT}/database/query/read-only" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"query":"select tablename from pg_catalog.pg_tables where schemaname = '\''public'\'' order by tablename;"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); rows=d.get('data',[]); print('\n'.join(str(r) for r in rows) if rows else '(no rows)')" \
  | redact_output \
  || echo "(could not query public tables — token/permissions may be insufficient; inspect redacted output above)"

echo "--- RLS policies on public tables (via Management API read-only query) ---"
curl --fail-with-body -sS \
  "${MGMT}/database/query/read-only" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"query":"select n.nspname as schema_name, c.relname as table_name, pol.polname as policy_name, pol.qual, pol.with_check, pol.perm from pg_catalog.pg_policy pol join pg_catalog.pg_class c on c.oid = pol.polrelid join pg_catalog.pg_namespace n on n.oid = c.relnamespace where n.nspname = '\''public'\'' order by c.relname, pol.polname;"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); rows=d.get('data',[]); print('\n'.join(str(r) for r in rows) if rows else '(no policies)')" \
  | redact_output \
  || echo "(could not query RLS policies — token/permissions may be insufficient; inspect redacted output above)"

echo "==> probe complete"
