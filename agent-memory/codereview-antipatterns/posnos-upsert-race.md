---
name: posnos-upsert-race
description: posnos (coffee-cart POS) has an established onConflictDo* upsert convention; new endpoints sometimes revert to a select-then-branch race instead
metadata:
  type: project
---

**The Pattern**: `src/app/api/events/route.ts` (POST) does upserts the right way — a single `db.insert(...).onConflictDoNothing()` (or should use `.onConflictDoUpdate()` when an update-on-conflict is needed). This is the established codebase convention for "insert or reuse/update a row keyed by an app-generated id."

**The Anti-Pattern Seen**: `src/app/api/events/[id]/materials/route.ts` (PUT, added 2026-09 for milk raw-material tracking) instead does `select` for an existing row, then branches to `insert` or `update` based on whether it found one. This is a TOCTOU race: two concurrent requests for the same composite key (e.g. `${eventId}-${materialKey}`) can both see "no existing row" and both attempt INSERT with the same PK, so one throws a duplicate-key error instead of a clean upsert. The DB is Neon over `drizzle-orm/neon-http`, so each statement is its own round trip — there's no implicit transaction wrapping the check and the write.

**Why This Matters**: posnos is explicitly multi-device — the home screen has a "join event" picker so multiple staff/stations hit the same event concurrently (see commit "Add join-event picker to the home screen"). Any endpoint that lets two stations write the same row concurrently is a plausible real race, not a theoretical one.

**How to Apply**: When reviewing any new posnos endpoint that writes a row keyed by an app-generated composite id (pattern: `` `${parentId}-${childKey}` `` as PK, seen in `orders.id` and `materialCounts.id`), check whether it uses `onConflictDoUpdate`/`onConflictDoNothing` (correct) or a manual select-then-insert-or-update (race-prone, flag it). Point to `src/app/api/events/route.ts` as the reference implementation.
