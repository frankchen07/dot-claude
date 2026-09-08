---
name: compound-capture-docs-writing
description: compound-capture skill (~/.claude/skills/compound-capture/SKILL.md) intentionally overrides the "don't write docs unless asked" default — and has an unstated edge case around CLAUDE.md files that don't exist yet
metadata:
  type: project
---

`~/.claude/skills/compound-capture/SKILL.md` instructs the agent to proactively write `docs/solutions/<slug>.md` files into whatever project repo it's working in, after any task judged "non-trivial" with a reusable learning — no per-task user request required.

**Intentional design, not an anti-pattern**: this directly overrides the general Claude Code norm of "never create documentation files unless explicitly requested" — Frank added this skill deliberately to build a compounding-learnings system, so the skill's existence is the standing "explicit request." Do not flag plain doc-file creation from this skill as a violation of the no-unsolicited-docs norm; that's the whole point of it.

**Real gap worth flagging on future review**: step 3 of the skill says "Check the repo's own CLAUDE.md for a pointer line. If missing, add one" — "missing" is ambiguous between (a) pointer line missing from an existing CLAUDE.md, and (b) the repo having no CLAUDE.md at all. As written, a literal reading could have the agent creating a brand-new CLAUDE.md in a project that never had one, just to hold one pointer line. That's scope creep beyond what "add a pointer line" implies. If this skill gets revised, this is the concrete fix to suggest: make it explicit that compound-capture only appends to an *existing* CLAUDE.md, never creates one from scratch.

Related: [[harness-config-lifecycle-consistency]] for how this skill's trigger condition threads through CLAUDE.md's Task-Lifecycle Skills section.
