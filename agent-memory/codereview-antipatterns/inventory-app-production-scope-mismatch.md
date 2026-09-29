---
name: inventory-app-production-scope-mismatch
description: inventory-tracker's src/lib/production.ts working tree is an active moving target during review; "pure rename" framing has undersold real logic changes bundled in the same uncommitted diff
metadata:
  type: project
---

On 2026-09-22, a review of a claimed "pure field rename" across `src/lib/sheets.ts`, `src/lib/types.ts`, `src/lib/production.ts`, `src/app/production/page.tsx` found the working-tree diff also contained, in the same uncommitted files:
- A new reserve-unit-conversion subsystem (`RECIPE_UNIT_OZ`, `resolveQuantity()`, `reserveUnitOz()` rewrite) that changes real production math for recipe-type reserve rows tracked in non-oz `amtUnit` — previously such rows were treated as already-oz.
- `ORDERS_HEADERS` column reorder (`notes, channel, active` → `channel, active, notes`) — a real sheet-column remapping, not a naming change; `readRows` maps by position.
- `StandingOrder`/`OneOffOrder.quantityUnit` type widened from `"count" | "oz"` to `string`.
- A new `DemandLine.recipeCategory` field threaded through most but not all display call sites (the "Heads up — next week" block in `page.tsx` was missed while the parallel "This week's deliveries" block got the new beans→lbs branch).

**Why:** the task description asserted "no logic change... byte-identical output verified," which was contradicted by the diff itself. Mid-review, `git diff` output for `production.ts` changed between two captures a few minutes apart (internal variable names `recipeByRecipeProduct`/`neededByRecipeProduct` became `recipeByName`/`neededByName`) — confirming another process/agent was actively still editing these files while this review ran. `git diff` has no way to isolate "the most recent changeset" from stacked uncommitted work; everything in the working tree shows as one diff.

**How to apply:** [[inventory-app-standing-order-cadence]] already flags production.ts as a brittle area (fail-open cadence logic, hardcoded-category drops). Add this to that list. When asked to review "just a rename" or "just a small change" in this file going forward:
1. Actually diff the claimed scope against what's in the file — don't trust the framing.
2. Consider re-running `git diff` a second time before finalizing the review if the task implies other work may still be in flight — the tree may not be stable.
3. Watch specifically for reserve-unit-conversion logic (oz vs. lbs/gallons for recipe-type entities) and `ORDERS_HEADERS`/`STANDING_ORDERS_HEADERS` column order — both have now been touched by non-rename changes and are exactly the kind of position-mapped, easy-to-silently-break constructs this codebase already relies on (per sheets.ts's own comments about the "standing-orders column-position lesson").
