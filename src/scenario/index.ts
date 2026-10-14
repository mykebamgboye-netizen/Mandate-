/* MANDATE — the Pack type represents the full document pack produced by a desk week.
   Imported by src/task/queue.ts as the type for the 'pack' field in DeskResult.
   Kept intentionally minimal — the shape is enforced by DeskResult and the
   initialResult() implementation uses a type assertion.
*/

export type Pack = Record<string, unknown>