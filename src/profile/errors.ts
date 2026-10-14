// @mandate/profile/errors — describe a thrown value for a human reader.
//
// Supabase throws plain objects ({ message, details, hint, code }), not Error instances, so
// String(err) renders "[object Object]" — which is exactly what a failed cloud save showed on
// the onboarding sheet. Every catch that reaches a player goes through here.
//
// The common Postgres/PostgREST codes are translated into what actually went wrong, because
// a player cannot act on "42501" but can act on "this device is not signed in".

/** Plain-language reasons for the codes this app can realistically hit. */
const CODE_MEANINGS: Record<string, string> = {
  '42501': 'the database refused the write — this device has no signed-in session, or a row policy rejected it',
  '23505': 'a file already exists for this account',
  '23502': 'the database required a field the form did not send',
  '22P02': 'the database rejected a value in the record (a bad id or date)',
  '42P01': 'the table is missing — the migrations have not been run on this project',
  PGRST116: 'no row came back',
  PGRST204: 'the database has no such column — the migrations are out of date',
}

/** The raw message, with the code and hint attached when the thrower supplied them. */
export function describeError(err: unknown): string {
  if (err == null) return 'unknown error'
  if (typeof err === 'string') return err || 'unknown error'
  // Error first, but not message-only: a PostgrestError/AuthApiError carries its code and
  // hint as fields, and that code is the part that says what actually went wrong.
  if (err instanceof Error) {
    const o = err as unknown as Record<string, unknown>
    const code = typeof o.code === 'string' ? o.code : ''
    const hint = typeof o.hint === 'string' ? o.hint : ''
    const base = err.message || err.name || 'unknown error'
    return `${base}${code ? ` [${code}]` : ''}${hint ? ` — ${hint}` : ''}`
  }
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>
    const message = typeof o.message === 'string' ? o.message : ''
    const code = typeof o.code === 'string' ? o.code : ''
    const hint = typeof o.hint === 'string' ? o.hint : ''
    if (message) {
      return `${message}${code ? ` [${code}]` : ''}${hint ? ` — ${hint}` : ''}`
    }
    try {
      return JSON.stringify(o)
    } catch {
      return 'an unreadable error'
    }
  }
  return String(err)
}

/** The sentence a player sees: the translation when we know the code, else the raw text. */
export function explainError(err: unknown): string {
  const code = err && typeof err === 'object' && typeof (err as { code?: unknown }).code === 'string'
    ? (err as { code: string }).code
    : ''
  const meaning = CODE_MEANINGS[code]
  if (meaning) return `${meaning} (${describeError(err)})`
  return describeError(err)
}

/** One line, trimmed to fit a toast. */
export function shortError(err: unknown, max = 110): string {
  const text = explainError(err)
  return text.length > max ? text.slice(0, max - 1) + '…' : text
}
