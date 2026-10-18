---
name: inventory-app-threshold-validation
description: inventory-tracker threshold/count parsing weak spots — lenient last-word unit heuristic in parseReportedQuantity ("2 sleeves of cups"), strict-vs-lenient split between write guard and read/count paths, weak parseConversion gate
metadata:
  type: project
---

As of 2026-10-15 (second round): `parseThreshold` (last-number) is gone. Thresholds read via `parseThresholdQuantity` = `parseReportedQuantity(first " or " segment)`. `checkThreshold` (MCP write guard) is strict: each "and" part must be exactly `<number> <unit>`. THREE_LEVEL now captures a named atomic ("50 cups per sleeve") as a level with perAtomic 1.

Recurring hole: `parseReportedQuantity` takes the FIRST number and LAST word of a segment. Only checkThreshold is strict; computeRestockList (hand-edited threshold cells) and record_inventory_count's needsUnit gate use the lenient parser. Adding the named atomic level made "3 sleeves of cups" silently = 3 cups (was null/needsReview before). Any new level added to parseConversion widens this hole.

Other known gaps:
- Mixed numbers "1 1/2 boxes" parse as 1 box (rest="1/2 boxes", last word boxes).
- `parseConversion(...).length > 0` gate is weak: SINGLE/TWO_LEVEL fallbacks match partial phrasings ("1 case has 4 boxes of 12 sleeves" -> 2 levels; "1 pack has 1120 napkins, 4 packs per box" has no box level).
- Unparseable conversion -> needsUnit with `units: []`, unresolvable by re-asking.

Intentional (don't flag): first "or" segment wins on legacy cells even when segments disagree (owner fixing sheet by hand); server deterministic, Claude.ai voice side does fuzzy translation; counts that don't convert are still written.

**How to apply:** any change to parseReportedQuantity/parseConversion/checkThreshold — test "N <unit> of <other level>" and mixed numbers. Related: [[inventory-app-ocr-validation]], [[inventory-app-row-alignment-and-static-date]].
