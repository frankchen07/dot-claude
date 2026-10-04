---
name: inventory-app-row-alignment-and-static-date
description: inventory-tracker brittle spots — readRows drops blank rows but date-column read/write index by position; /scans/upload is statically prerendered so todayISO() default is frozen at build
metadata:
  type: project
---

Two pre-existing brittle spots confirmed during the 2026-10-02 cleanup-refactor review (not regressions of that refactor):

1. **Row alignment.** `readRows()` in src/lib/sheets.ts filters out fully-blank rows, but `readLatestValues()` (values[i] = sheet row i+2) and `writeColumnValues()` (catalog[i] -> row i+2) are positional. A blank spacer row in the middle of "inventory" or "reserve stock" shifts every later item's count onto the wrong row, both on read AND on write (writes then corrupt the sheet). The old per-column `readColumnValues` had the same flaw.
**How to apply:** don't flag it as a regression when date-column code changes, but re-mention it if anyone touches readRows filtering or the write path. Real fix would be keeping a source row index (the old `_rowIndex` field, removed 2026-10-02 as "unused", was exactly the hook for this).

2. **/scans/upload is static** (prerender-manifest: compute "static", revalidate false). `<UploadForm defaultDate={todayISO()} />` is evaluated at build time, so the default scan date is the deploy date. Changes to todayISO() local-vs-UTC are moot for this page in prod.
**How to apply:** flag any "date default" change here as cosmetic unless the page gets `dynamic = "force-dynamic"` or the date moves client-side.

Also: Vercel runtime is UTC, so dates.ts local-time helpers equal UTC in prod; local-vs-UTC differences only show in local dev (Mac, Pacific).
