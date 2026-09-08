---
name: harness-config-lifecycle-consistency
description: Frank's ~/.claude/CLAUDE.md defines a multi-stage skill/agent lifecycle across three separate sections that must stay in sync — check this whenever CLAUDE.md or a task-lifecycle/subagent-checker skill is edited
metadata:
  type: project
---

Frank's global `~/.claude/CLAUDE.md` encodes an "airtight implementation" workflow across three sections that describe the *same* sequence from different angles and must be kept mutually consistent:

1. **Task-Lifecycle Skills** (judgment skills, invoked directly by the main model): explore-effective-efficiency → coding-scope-discipline/coding-native-code → output-prove-it → compound-capture → output-do-the-work/comms-outcome-first → audit-session-summary.
2. **Subagent Checkers** (external reviewer agents, invoked via Agent tool): codereview-antipatterns + codereview-overengineering (run together, independent) → verify-e2e-complete → verify-spec-match / codereview-claudemd / test-ui / debug-root-cause (situational).
3. **Agents & Skills Together** — a numbered example sequence interleaving both lists into one canonical order.

**Why this matters**: these three sections cross-reference each other (e.g. the Task-Lifecycle bullet for `compound-capture` says "after verify-e2e-complete confirms ... done," but `verify-e2e-complete` itself is only defined in the Subagent Checkers section, not in the Task-Lifecycle list). This is intentional interleaving, not a bug, but it means a future edit to just one section (e.g. reordering the numbered example, or adding a new lifecycle skill) can silently desync it from the other two. There's also tension with the header "External reviewers — use after task-lifecycle skills, not instead of them" (Subagent Checkers section) — read literally this suggests checkers run only after ALL lifecycle skills finish, but the actual intended flow interleaves `verify-e2e-complete` *between* task-lifecycle skills (after output-prove-it, before compound-capture/output-do-the-work). Not a blocking bug, but worth flagging if the wording is ever tightened.

**How to apply**: When reviewing a diff that touches CLAUDE.md's Task-Lifecycle Skills, Subagent Checkers, or Agents & Skills Together sections, diff all three against each other, not just against git history — check that every item added/reordered in one section is reflected consistently in the others.

See also [[compound-capture-docs-writing]] for the specific new compound-capture skill's design tradeoffs.
