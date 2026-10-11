// @mandate/profile — public API for the persistent player profile + federation reference.
// This barrel is the layer the rest of the app imports. It keeps the Supabase client behind
// a small surface so the rest of the app never reaches into env or RLS details.

export * from './types'
export * from './client'
export * from './prologue'
export * from './delta-tutorial'
export * from './onboarding'

// schema exports startingPatronageBankForOffice; this barrel re-exports it once to avoid a
// duplicate-name collision when schema and onboarding are both reachable from the app.
export { startingPatronageBankForOffice } from './schema'
