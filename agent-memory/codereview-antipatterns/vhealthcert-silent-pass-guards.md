---
name: vhealthcert-silent-pass-guards
description: vhealthcert (VetTravel Verify rules engine): recurring "guard skips check when fact is missing" silent-pass pattern, brittle ctx coupling between rules, and intentional designs not to flag
metadata:
  type: project
---

Product promise: uncertainty surfaced, never hidden. Any path to "satisfied" with a missing fact is critical.

Recurring anti-pattern (first review 2026-10-09):
- `if (spec.x && ctx.y && <check>)` guards in lib/engine/requirements.ts — when ctx.y is null the check is silently skipped and the requirement passes (titer afterMicrochip with no chip implant date).
- Ordering checks delegated between rules ("enforced by the FAVN rule") — verify the receiving rule actually enforces it when data is missing.
- Downstream rule falls back to raw input when upstream rule bailed early (rabiesTiter uses unfiltered vaccinations when rabiesSeries returned cannot_determine without setting ctx.series).
- Unmodeled pathways encoded as `informational` + manualReview → readiness tops out at "Potentially ready" instead of unsupported.

Brittle areas: requirements.ts ctx mutation between rules (ctx.chip, ctx.series, ctx.actionDates); freshness logic duplicated in components/source-status.tsx vs lib/engine/verification.ts (local vs UTC date); magic string `calc[0].expr === "Today"` in UI.

Intentional (do not flag as bugs):
- Unset PILOT_CODES = open access for local dev (tested). Flag only lack of a production fail-closed guard.
- Source hash change → verified_review (soft), tested on purpose.
- All rules `review: null` while KB is draft; golden test asserts it as a tripwire.
- Excerpt status keys are index-based (`rule#i`) but CI integrity test pins them to committed snapshots.

**Why:** these were the root causes behind the first review's FAIL verdict.
**How to apply:** on re-review, grep requirements.ts for `&& ctx.` guards and check each null branch returns cannot_determine.

France/EU review (2026-10-19):
- New brittle spot: rabies_series `primary` — the wait raises earliestArrival but is NOT added to the planned dose's `latest` bound (deadline only gets minDaysBeforeArrival). Check planned-action windows, not just status/earliestArrival, whenever a new wait/validity knob is added.
- `primary` cap only applied inside the requireContinuity branch; type allows primary + requireContinuity:false (latent silent pass). Prefer type coupling or KB integrity assert.
- breed_restriction has no "depends on uncollected fact" outcome: pedigree-dependent breeds (FR Cat 1: AmStaff/Mastiff/Tosa) return satisfied + reviewNote (verified_review once reviewed), not cannot_determine.
- Intentional: APHIS 1-year primary cap applied to all doses even though APHIS scopes it to US-vaccinated (conservative). Excerpt matching is normalized lowercase substring (lib/sources/text.ts) — judge "too generic" excerpts with that in mind.
