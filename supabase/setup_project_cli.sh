#!/usr/bin/env bash
# Apply the MANDATE profile + federation reference schema and seed using the Supabase CLI.
# Credentials are read interactively from the terminal so they are never written to disk
# and never printed back. Run: bash supabase/setup_project_cli.sh
set -euo pipefail

printf 'Supabase access token (never stored or printed): '
read -r ACCESS_TOKEN
printf 'Project db password (never stored or printed): '
read -r -s DB_PASSWORD
printf '\n'

: "${ACCESS_TOKEN:?abort: no access token provided}"
: "${DB_PASSWORD:?abort: no db password provided}"

export SUPABASE_ACCESS_TOKEN="$ACCESS_TOKEN"
export SUPABASE_PROJECT_REF="eechinfurzvfinobuyyg"
export SUPABASE_DB_PASSWORD="$DB_PASSWORD"

_TOKEN_PREFIX="${SUPABASE_ACCESS_TOKEN:0:8}"
_TOKEN_REST="${SUPABASE_ACCESS_TOKEN:8}"

redact_token() {
  # Replace the first 8 chars of the token with a redaction marker and hide the rest.
  sed -e "s/${_TOKEN_PREFIX}/<TOKEN_PREFIX_REDACTED>/" \
      -e "s/${_TOKEN_REST}/<TOKEN_REST_REDACTED>/" \
      -e "s/<DB_PASSWORD_REDACTED>/${DB_PASSWORD}/g" \
      -e "s/<DB_PASSWORD_REDACTED>/${DB_PASSWORD}/g" 2>/dev/null \
  | sed -e "s/${DB_PASSWORD}/<DB_PASSWORD_REDACTED>/g"
}

echo "==> linking CLI to project ${SUPABASE_PROJECT_REF}"
npx supabase link \
  --project-ref "${SUPABASE_PROJECT_REF}" \
  --password "${SUPABASE_DB_PASSWORD}" \
  2>&1 \
  | redact_token \
  | sed -n '1,80p' \
  || { echo "(link failed — inspect above; verify access token + db password)"; exit 1; }

echo "==> pushing migrations + seed to remote (one-time setup)"
npx supabase db push \
  --include-seed \
  --password "${SUPABASE_DB_PASSWORD}" \
  2>&1 \
  | redact_token \
  | sed -n '1,200p' \
  || { echo "(db push failed — inspect above)"; exit 1; }

echo "==> done"
