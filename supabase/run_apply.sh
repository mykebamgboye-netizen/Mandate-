#!/usr/bin/env bash
# One-shot apply of the MANDATE profile + federation reference schema + seed to the live project.
# Credentials are read from /tmp/supabase_creds.txt (one per line: ACCESS_TOKEN, DB_PASSWORD).
# The real values are never printed; output is redacted before display.
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
: "${DB_PASSWORD:?abort: no db password in $CREDS_FILE}"

redact_output() {
  # Redact anything that looks like a long token/password before printing.
  sed -E \
    -e 's/[A-Za-z0-9+/=]{20,}/<TOKEN_REDACTED>/g' \
    -e 's/eechinfurzvfinobuyyg/<PROJECT_REF>/g' \
    -e "s/${DB_PASSWORD}/<DB_PASSWORD_REDACTED>/g" \
  | sed -n '1,300p'
}

export SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN"
export SUPABASE_DB_PASSWORD="$DB_PASSWORD"
export SUPABASE_PROJECT_ID="$PROJECT_REF"

echo "==> linking CLI to project <PROJECT_REF>"
npx supabase link --project-ref "$PROJECT_REF" 2>&1 | redact_output \
  || { echo "(link failed — inspect redacted output above; verify token + db password)"; exit 1; }

echo "==> pushing migrations + seed to remote (one-time setup)"
npx supabase db push --include-seed --yes 2>&1 | redact_output \
  || { echo "(db push failed — inspect redacted output above)"; exit 1; }

echo "==> done"
