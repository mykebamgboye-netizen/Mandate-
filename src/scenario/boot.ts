/* MANDATE — the boot rule.
   What the app opens with is a decision about the record, not about a scenario: a record on
   this phone builds its desk; a signed-in player whose record is in the database has it read
   back; with neither, the wizard is the only way onto a seat. Extracted so it can be tested
   rather than only observed — the old inline version quietly fell back to an NPC's desk. */

export type BootTarget =
  /** persist.profile exists — build the desk from it, no network needed */
  | 'desk'
  /** signed in and configured, but no local record: read the row back from Supabase */
  | 'fetch-profile'
  /** nothing to build a desk from: the first-open wizard */
  | 'wizard'

export interface BootFacts {
  hasProfile: boolean
  profileHandle: string | null | undefined
  supabaseConfigured: boolean
  /** a wizard the player is already inside must never be clobbered */
  wizardLive: boolean
}

export function bootTarget(f: BootFacts): BootTarget {
  if (f.hasProfile) return 'desk'
  if (f.profileHandle && f.supabaseConfigured) return 'fetch-profile'
  return 'wizard'
}
