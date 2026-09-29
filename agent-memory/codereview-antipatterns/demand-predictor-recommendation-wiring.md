---
name: demand-predictor-recommendation-wiring
description: demand-predictor recommendation-engine wiring path — compute route redirect target, comparison page conventions
metadata:
  type: project
---

In demand-predictor, `src/app/api/recommendations/compute/route.ts` (POST handler for
`GenerateRecommendationForm`) hardcodes a single redirect target with no return-path param —
the form action is `"/api/recommendations/compute"` with no `next`/`from` field, so the route
can't know which page submitted it. As of 2026-09-14 it redirected to `"/"`; as of 2026-09-21
it redirects to `"/dashboard/comparison"` (still wrong — see below). This is the exact bug
predicted in the prior note ("check this route again ... if a second caller is added elsewhere
expecting to land back on itself") — it came true on 2026-09-21.

2026-09-21 update: the diff that added `/recommendations` (the new primary page showing
`suggestedBakeQty`/confidence + `fetchLatestComparison` accuracy) *also* pasted
`GenerateRecommendationForm` onto the old `src/app/dashboard/comparison/page.tsx` — even
though that page was supposed to be nav-unlinked-only ("Data views" dropped from home nav,
file otherwise untouched per the stated spec). Now there are two live callers of the same
hardcoded-redirect form, and the redirect target (`/dashboard/comparison`) matches only the
old, now-orphaned-from-nav page — so generating from the new `/recommendations` page bounces
the user to a page nav no longer links to, instead of back to `/recommendations` where the
Suggested-bake/accuracy tables actually live. Root cause is structural: the form has no
caller-aware redirect. Check this route every time a new caller is added — the fix needs a
`next`/`redirectTo` hidden field read by the route, not another hardcoded string swap.

Established conventions worth reusing as a baseline when reviewing this codebase:
- `date()` columns in `src/lib/db/schema.ts` (e.g. `recommendations.recommendationDate`) are
  compared/stored as plain `"YYYY-MM-DD"` strings via drizzle's default string mode — matches
  `getNextRecommendationDate()` in `src/lib/recommendation-engine.ts` and the delete-then-insert
  "regenerate replaces, not stacks" pattern in `computeRecommendationsForBusiness`. Don't flag
  string-typed date comparisons here as a type bug — it's intentional and consistent.
- `BUSINESS_SLUG = "midwife-and-baker"` is hardcoded per-page (single-tenant app), not a config
  gap — repeated across `src/app/page.tsx` and `src/app/dashboard/comparison/page.tsx`.

Brittle area: `computeRecommendationForProductBatch` in `src/lib/recommendation-engine.ts` builds
the same `reasoning: {...}` object literal independently at 3 call sites (two early returns for
`rows.length === 0` / `demands.length === 0`, plus the full-computation success path). The
2026-09-21 per-item critical-ratio diff (adding `criticalRatio`/`criticalRatioSource`, sourced
from the new `FALLBACK_CRITICAL_RATIO` export and `computeCriticalRatio()` in `demand-calc.ts`)
kept all 3 copies consistent — `criticalRatio.ratio` is unrounded and identical at all 3 sites
(verified 2026-09-21, no `Math.round` applied to it anywhere in the file). An earlier note here
claimed a rounding-drift bug (rounding added at only the success-path site); that was checked
against the code and does not exist — corrected/removed so it doesn't cause a false positive in
a future review. The underlying risk is still real, just not currently triggered: any future edit
to one of these 3 reasoning-object copies should be diffed against the other 2, since this
function has a track record of drifting across its copy-3x sites.

Security-relevant note from the same diff: `reasoning.criticalRatio` (when `criticalRatioSource
=== "item"`) encodes `1 - unitCost/unitPrice`, i.e. exact per-product gross margin — derived from
the same `unitPrice`/`unitCost` fields that `/products` (owner-only, gated by `mtb_owner_auth` in
`src/proxy.ts`) was built to hide from base-passphrase holders. This `reasoning` object is
persisted to `recommendation_line_items.reasoning` (jsonb) via `computeRecommendationsForBusiness`,
reachable through `POST /api/recommendations/compute` — a route gated only by the base passphrase,
not the owner one. As of 2026-09-21 nothing renders `reasoning` in any UI (checked
`src/app/dashboard/comparison/page.tsx` and grepped the whole `src/app` tree), so there's no live
leak yet — but the very next person who wires "show why this recommendation was made" into the
comparison page (a natural, likely addition) will silently reintroduce the margin leak the owner
gate exists to prevent. Flag this if `reasoning` (or `criticalRatio` specifically) ever gets
rendered/returned on a non-owner-gated path.
