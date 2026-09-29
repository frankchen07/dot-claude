---
name: inventory-app-standing-order-cadence
description: inventory-tracker production.ts standing-order cadence (isDueThisWeek) fail-open design, and the demand-line-shaping extraction pattern used for look-ahead views
metadata:
  type: project
---

In `inventory-tracker` (`src/lib/production.ts`), `isDueThisWeek(order, popupWeekStart)` treats a
blank or unparseable `anchorDate` as "always due" (fails open), not "always skip." This is
**intentional**, per the comment on `StandingOrder` in `src/lib/types.ts`: a misconfigured row
over-producing one week is visible/correctable, while one that silently skips a real delivery is
not. Don't flag this as a swallowed-error / silent-failure anti-pattern — it's a deliberate
fail-open choice for a supply chain where under-producing is the worse failure mode.

Reviewed 2026-09-16: the "next week's periodic orders" look-ahead feature
(`getUpcomingStandingDemand`, `upcomingDemand` on `ProductionPlan`) correctly keeps its output
isolated — flows only into the final returned object, never into
`neededByRecipeProduct`/`demandByProduct`/`batches`/`productRequirements`. This separation (raw
look-ahead demand vs. real batch-math demand) is the load-bearing invariant for this feature;
re-check it explicitly any time `upcomingDemand` or a similar "preview" field is touched again —
folding it into the accumulator loops would double-count that order's oz.

2026-09-22 review (later same day, separate/stacked changeset from the recipeCategory one below) —
the real bug fix: reserve-stock entities of `entityType: "recipe"` had `reserveUnitOz()` hardcoded
to `1` (assumed already-oz), but Frank had started writing colloquial units ("6 gallons", "100 lbs")
directly into the "reserve stock" sheet's amt/amtUnit for recipe rows. Fix added a small
`RECIPE_UNIT_OZ` table (oz/ounce/lb/pound/gallon/gal) keyed through the existing (newly-exported)
`normalizeUnit()` from unit-conversion.ts, and `reserveUnitOz()` now looks entity.amtUnit up in it
for recipe-type entities (product-type unchanged, still uses the product's own `unitOz`). Verified
both use sites fixed: the display-only `reserveLevels` push (`amtOz`/`onHandOz`) AND, more
importantly, the recipe-level netting loop building `neededByRecipeProduct` (the one that actually
feeds `batches`/"To make Mon/Tue") — both now multiply `entity.amt`/`onHand` by `reserveUnitOz(entity)`
before treating them as oz. `tsc --noEmit` and `eslint` both clean; grep confirmed removed
`ReserveLevel.category` has zero remaining references anywhere (fully dead, not removed prematurely).
`ORDERS_HEADERS` reorder is safe: `getOneOffOrders()`/`readRows` only consume it by field name, no
positional-array reads found anywhere in the codebase.

One real gap worth flagging on any future touch of `reserveUnitOz`/`RECIPE_UNIT_OZ`: an amtUnit not
in the table (typo like "galons", or a new unit like "quart"/"kg") silently falls back to `?? 1`
(treated as already-oz) — the exact same silent-misinterpretation failure mode this diff was written
to fix, just for anything outside the ~6-entry table, and with zero warning/logging. Given this table
now feeds real batch-math (how much to brew/roast), a typo here has real production consequences
(silent under-brewing) with no way to notice from the UI. Worth pushing for at least a `console.warn`
on an unrecognized-but-nonempty amtUnit for a recipe entity, next time this function is touched.

Established pattern worth reusing as a baseline: when the same demand-line-shaping logic needs to
apply to more than one "view" of standing orders (this week's real demand vs. next week's
look-ahead), the codebase extracts a small pure helper (`standingOrderDemandLine`, `fillOz`) keyed
by `weekStart`/`lines` params rather than duplicating the shape inline — good, keep expecting this
convention, and diff the extracted helper against the original inline block field-by-field when
reviewing an extraction-only change (this one preserved behavior exactly).

2026-09-22 review — display-only reformat of `/production` (uncommitted, not yet a commit):
added `DemandLine.displayQty` (computed in `fillOz()`) and `ReserveLevel.category` (populated in
the `reserveLevels` loop from `recipeByRecipeProduct.get(entity.entity)?.category`), plus a new
`reserveRowDisplay()` helper in `page.tsx` that branches on `entityType`/`category` ("product" /
"beans" / everything else). Traced full path, `tsc --noEmit` and `eslint` both clean, oz math in
`fillOz()` verified byte-for-byte identical to pre-diff (only the added `displayQty` field is new).
Good sign for the "hardcoded-category-silently-drops-rows" brittle spot noted above:
`reserveRowDisplay`'s 3-way branch has a real fallback arm (unmatched category still renders a full
row, just without the lbs conversion) — same generalized-fallback discipline as
`trailingCategories`, not a repeat of the old bug. One loose end, non-blocking: the function's own
comment says "topUpQty is always in the row's own native unit already ... so 'need' reads directly
off it rather than being reconverted from oz," and the "product"/"beans" branches do that
(`r.topUpQty`, `r.topUpQty / 16`), but the generic/else branch still computes `need` from
`r.amtOz - r.onHandOz` (unchanged from the pre-diff line) instead of `r.topUpQty` directly.
Numerically identical today only because `reserveUnitOz()` returns 1 for every recipe-type entity —
if that ever stops being a hard invariant, this branch silently drifts from the comment's stated
contract. Worth a quick recheck next time `reserveRowDisplay` or `reserveUnitOz` is touched.

2026-09-22 review — `DemandLine.displayUnit` added (types.ts/production.ts/page.tsx, uncommitted, on
top of the displayQty diff above). `amtUnitByEntity` (entity→amtUnit from reserve-stock rows) feeds
`displayUnit` in both `fillOz()` branches: count-branch looks it up directly by `line.item`
(product name), oz-branch looks it up by `sourced[0].product` (the single product sourced from that
recipe, when unambiguous) — both are pure functions of `line.item` alone given a fixed
`stockEntities`/`products` snapshot, so **within one branch** the "same displayUnit for the same
item across every line" assumption genuinely holds per-call. `tsc --noEmit` clean.

The gap: nothing prevents the *same* `item` string from appearing on one line as quantityUnit "count"
and another as "oz" — `DemandLine.item`/`StandingOrder.item` is documented in types.ts as "genuinely
either a Product name or a Recipe name" depending on quantityUnit, and `parseQuantityUnit()` silently
defaults anything not exactly `"oz"` to `"count"` (same fail-open-on-bad-data family as
`isDueThisWeek` above — but unlike that one, nothing here documents it as *intentional*). A blank/
typo'd quantityUnit cell on one order for an item normally drawn as "oz" would silently collide with
that item's "count" identity. `page.tsx`'s `popupTotals` aggregation (keyed by `line.item`) captures
`displayUnit` from whichever line is encountered *first* for that item and never re-checks it against
later lines — no dev warning, no assertion, and (as of this diff) no code comment even naming the
assumption, unlike this file's otherwise heavily-commented style. Low real-world odds (would need an
actual name collision or data-entry mistake) and cosmetic-only blast radius (wrong/missing unit
label, not a batch-math error — displayUnit never feeds `oz`/batches/productRequirements), but same
"unenforced invariant over free-text sheet data" shape as the category-fallback brittleness noted
below. Worth a quick recheck if `popupTotals` or `amtUnitByEntity` changes again, and consider
recommending a dev-time consistency check (warn if a later line's non-null displayUnit disagrees with
the stored one) rather than silent first-wins.

2026-09-22 review (later same day) — third field in the same sequence: `DemandLine.recipeCategory`
added (types.ts/production.ts/page.tsx, uncommitted, on top of the displayQty/displayUnit diffs
above). Populated in `fillOz()`'s oz-branch from `recipeByRecipeProduct.get(line.item)?.category`,
always null for count-branch lines (documented as intentional — count lines always have non-null
displayQty already). Both new `DemandLine`-construction call sites
(`standingOrderDemandLine`, the one-off-order push in `getDemandForWindow`) correctly seed
`recipeCategory: null` as a fillOz()-filled placeholder, matching the existing oz/displayQty/
displayUnit convention exactly. `tsc --noEmit` and `eslint` both clean. Two non-blocking findings:
(1) cosmetic bug — the new "This week's deliveries" render site (`page.tsx` ~line 219) renders
`{roundDisplay(line.oz / 16)}lbs` with no space before "lbs", the only one of 4 "lbs"-rendering
call sites in this file missing the space (batchHeadline, reserveRowDisplay, and the popup-section
render site all have `... / 16)} lbs` with a space). Purely visual, one-line fix.
(2) scope-confirmed inconsistency, not a bug — "Heads up — next week" (`upcomingDemand`) goes
through the same `fillOz()` and so already carries populated `recipeCategory`, but its render block
(page.tsx ~line 249) was deliberately not touched by this diff (explicit user scope instruction) and
still always shows raw oz for oz-quantityUnit lines. Net effect: a next-week preview of a "beans"
oz-line will show raw oz while the same line, once it's *this* week, would show lbs — a real
visible inconsistency, but intentionally deferred, not an oversight. Worth fixing in the next pass
that touches this section. Also minor: the `DemandLine.recipeCategory` doc comment in types.ts
frames the field as being for "when displayQty fell back to null" — accurate for the popup-section
site (which does gate on `displayQty !== null` first) but the deliveries-section site uses
`recipeCategory` unconditionally for every oz line regardless of displayQty status (matches
pre-diff behavior there, since that site never consulted displayQty/displayUnit to begin with — not
a regression, just a comment that undersells actual usage scope).

RESOLVED 2026-09-16 (same session as the `product`→`item` rename below): the double-fetch above is
gone. `getDemandForWindow`/`getUpcomingStandingDemand` were changed to take `standing`/`oneOff` as
params instead of fetching internally; `computeProductionPlan()` now calls `getStandingOrders()`
once and shares the result. Confirmed via diff — no longer worth flagging.

2026-09-16 review — `product`→`item` rename on `StandingOrder`/`OneOffOrder`/`DemandLine` (deliberately
NOT applied to `Product.product`/`ProductRequirement.product`, which are genuinely always product
names) plus generalizing `src/app/production/page.tsx`'s third category section from a hardcoded
`byCategory.get("roast")` check into a `trailingCategories` loop over whatever categories exist,
labeled via `CATEGORY_LABEL[category] ?? category`. Both were clean: full-repo grep for `\.product\b`
found only correct `Product`/`ProductRequirement` usages, `tsc --noEmit` passed clean, and the
category fallback was traced (not just live-confirmed) to actually render an unmapped/stale category
under its raw name rather than dropping it. Worth remembering as a **known brittle area**: this
codebase has been bitten twice now by hardcoded enum-like branches over a free-text sheet column
(category values) silently dropping unmatched rows — when reviewing other pages here, check for
similar `Record<string, X>` / fixed-value switches over sheet-sourced string fields (recipe
category, product source, etc.) that don't have a generic fallback path like `trailingCategories`.
