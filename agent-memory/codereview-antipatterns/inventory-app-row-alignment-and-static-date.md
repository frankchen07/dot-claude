---
name: inventory-app-row-alignment-and-static-date
description: inventory-tracker — row alignment now keyed by real sheet rowIndex (positional bug fixed); count writes are per-cell batchUpdate; /scans/upload static-date note
metadata:
  type: project
---

1. **Row alignment (resolved by 2026-10-15).** `parseRows` keeps `_rowIndex` (real sheet row) and drops blank rows; `CatalogItem.rowIndex` carries it. As of the 2026-10-15 change, `writeCountColumn` writes only the passed items via `writeCells` (values.batchUpdate, one A1 range per cell) — no more whole-column rewrite, so blank spacer rows and same-day earlier counts are untouched. `writeColumnValues`/`columnByRow` were removed (legitimately subsumed, not deleted-instead-of-fixed).
**How to apply:** if anyone reintroduces a whole-column write (values.update over `col2:colN`), flag it — that was the bug that wiped same-day MCP counts on a later scan confirm. Side effect of the fix: neither scan confirm nor MCP can *clear* a cell except MCP with `count: ""` (schema has no min length).

2. **/scans/upload static date** — fixed in commit 39de89b (renders per request). Don't re-flag.

Also: Vercel runtime is UTC; dates.ts now uses shop timezone (Pacific) per commit a66add4.

Stale doc to watch: docs/solutions/verifying-refactors-against-live-sheet.md still names `writeColumnValues` and the positional-row caveat.
