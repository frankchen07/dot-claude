---
name: compound-capture
description: Use after verify-e2e-complete (or output-prove-it, if verify-e2e-complete wasn't invoked) confirms a non-trivial task is genuinely done, to capture one reusable learning into the current project repo so the next similar task is easier. Skip entirely for trivial or mechanical changes — this must not fire on every task.
---

Capture one reusable learning per meaningfully novel task into the current project repo, so a future session (yours or anyone else's) doesn't re-pay the same cost.

## What to do

0. **Self-check first.** Was there an actual reusable learning — a root-caused bug, a real tradeoff decision among alternatives, a framework/library gotcha, a codebase convention discovered the hard way, something that took more than one attempt or real research? If the task was mechanical (typo fix, copy tweak, CRUD following an existing identical pattern), stop here with no output. One learning per novel task, not one per task.

1. **Check for an existing writeup.** Grep the current repo's `docs/solutions/` for a file on the same topic. If one exists, extend it rather than creating a near-duplicate.

2. **Write or update** `docs/solutions/<kebab-case-slug>.md` in the current project repo (not `~/.claude`):
   ```
   # <Short title>

   **Date**: YYYY-MM-DD

   ## The problem
   ## The solution / decision
   ## Why it wasn't obvious
   ## Pointers
   - files / commands / links
   ```

3. **If the repo already has a `CLAUDE.md`**, check it for a pointer line and add one if missing (idempotent — don't duplicate on repeat runs):
   `Check docs/solutions/ for prior learnings on similar tasks before starting new work.`
   Never create a `CLAUDE.md` that doesn't already exist just to hold this pointer — if the repo has none, skip this step.

This is distinct from `agent-memory/codereview-antipatterns/` (global, agent-scoped, lives in `~/.claude`) and from the cross-project personal memory system under `~/.claude/projects/.../memory/` (about the user as a person — preferences/feedback — not repo-specific technical learnings). `docs/solutions/` is repo-committed and general-purpose, so it's visible to anyone who clones the project.
