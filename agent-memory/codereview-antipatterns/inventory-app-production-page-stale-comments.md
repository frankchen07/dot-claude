---
name: inventory-app-production-page-stale-comments
description: production/page.tsx comments quote literal old heading text ("Also make", "To make Mon/Tue") that drifts out of sync when headings get renamed — check comment prose against current JSX strings, not just logic
metadata:
  type: project
---

On 2026-09-23, reviewed a diff that renamed several section headings in `src/app/production/page.tsx` ("To make Mon/Tue" → "Brewing & Roasting Needed", "Also make" → "Assemble Products", separate "Brew concentrate"/"Make ingredients" sections merged into "Make Recipes"). The rename was clean functionally (verified no dangling refs, correct list-merge logic for the concentrate/ingredient union, CATEGORY_LABEL lookup safely unreachable for removed keys because `trailingCategories` explicitly filters `concentrate`/`ingredient` out). But two comments were left quoting the pre-rename heading text verbatim and are now stale:
- Line ~76-77 (`reserveRowDisplay` doc comment): still says `"Also make"/ "To make Mon/Tue"` — both renamed.
- Line ~108-109 (`trailingCategories` comment): still says `"fixed positions around "Also make" below"` — renamed to "Assemble Products", and the actual fixed-position section is now "Make Recipes" not "Also make".

**Why:** this file's comments habitually quote literal UI copy (heading strings) as anchors instead of describing structural position abstractly. That makes the comments accurate at write-time but guaranteed to silently drift whenever a copy-only rename lands — copy renames don't touch the logic the comment is actually documenting, so nothing forces someone to revisit the comment.

**How to apply:** whenever a future diff touches heading/label strings in this file, grep the file for other comments quoting the old string (`grep -n '"<old heading text>"' src/app/production/page.tsx`) before passing review — don't assume a "just a rename" diff can't have stale-comment fallout elsewhere in the same file. This is a minor/non-blocking finding, not a correctness bug — flag it, don't block on it. Related: [[inventory-app-production-scope-mismatch]] (same file, different issue — that one was about undersold logic scope, this one is comment drift on pure renames).
