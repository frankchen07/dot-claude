---
name: posnos-silent-fetch-failures
description: posnos client components default to fire-and-forget fetch with no res.ok check and no catch; fixes get applied to the one debugged function and not its siblings
metadata:
  type: project
---

**The Pattern (house default, mostly unintentional)**: posnos client components call `await fetch(...)` for mutations and never check `res.ok` or catch. Seen in `createOrJoinEvent` and `submitOrder` (`src/components/catering-app.tsx`), `confirmDelete` (`src/components/event-history.tsx`), and the material-count save path. The read path is the opposite — `src/lib/fetcher.ts` *does* throw on `!res.ok`, so SWR reads are guarded and writes are not.

**The Anti-Pattern Seen (2026-09)**: The "can't end an event on iPhone" fix (window.confirm suppressed by iOS Safari → returned false → silent bail) correctly added `res.ok` checks + an error banner to `startTimer`/`confirmEnd`, but left `createOrJoinEvent` — three functions above, in the same file, with the new `error` state in scope — as `try { ... } finally { setCreating(false) }` with no catch and no `res.ok` check. `POST /api/events` returns 400 `{error}` for a blank name, so `json.event.id` throws a TypeError into an unhandled rejection: button un-disables, nothing happens. Identical symptom class to the bug being fixed. Same for the Delete flow in `event-history.tsx`, which got the new ConfirmDialog but no error handling at all.

**Second half of it**: the replacement error surface was a normal-flow banner rendered *below* a `sticky top-0` header. The trigger buttons live in the sticky header and stay tappable while the page is scrolled, so the failure message renders off-screen — reproducing "tap did nothing" through a different mechanism. Any in-page replacement for `window.alert` in this app has to be sticky/fixed, because every screen is a sticky header over a scrolling `main`.

**Why This Matters**: this is a phone-in-hand POS used during live catering. A destructive or state-changing tap that fails silently is indistinguishable from a tap that didn't register, and the operator just taps again.

**How to Apply**: when reviewing any posnos change that adds error handling to a mutation, grep the whole file (and its sibling component) for other `await fetch(` calls and check whether they got the same treatment — partial sweeps are the norm here. Also verify any new error/toast surface is not positioned where a scrolled page hides it.
