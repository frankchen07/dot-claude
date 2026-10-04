---
name: coding-codebase-cleanup
description: Use when asked to review a codebase (or a large area of one) for redundancy, dead code, duplication, or simplification — "clean this up", "look for redundancies", "simplify the codebase", "tech debt pass". Splits findings into no-behavior-change cleanup (done now, behind a safety net) and behavior-changing improvements (written up as a plan for later). Not for reviewing a single diff — use /simplify or the codereview-* agents for that.
---

# Codebase Cleanup

## Overview

A cleanup pass is only valuable if nothing breaks. The whole method is: prove current behavior
first, change structure, prove behavior again. Anything that would change behavior — even an
obvious bug fix — is not cleanup; it goes on the improvements list for Frank to schedule.

## The two buckets

- **Cleanup (no behavior change)** — dead code, unused fields/deps/assets, duplication, redundant
  I/O (N+1 calls, re-fetching the same data), stale/duplicated/historical comments, stale docs.
  Done in this pass.
- **Improvements (behavior change)** — bugs, UX fixes, security hardening, formatting
  inconsistencies users can see. Ranked by impact, written up, *not* built. Bugs found mid-pass
  go here too.

If moving an item between buckets needs an argument, it's an improvement.

## Steps

1. **Inventory.** List every tracked file with line counts. Small codebase (< ~5k lines): read it
   all yourself — don't fan out agents. Note baseline: typecheck, lint, build, test status.
2. **Plan, then approve.** Write both buckets to the plan (file:line, one line each). Cleanup items
   grouped: dead code / duplication / comments+docs. End with concise unresolved questions. Get
   approval before touching code.
3. **Safety net before any refactor.**
   - No test runner? Add the lightest native one (e.g. Node: `node --import tsx --test`).
   - Extract pure functions where the logic is tangled with I/O (inputs + "today" passed in), and
     write characterization tests against current output — hand-computed expectations, green
     before you refactor.
   - Capture a **golden** of real output: a throwaway script dumping the key computed data to
     JSON, and the rendered HTML of every page (scripts/styles stripped). Store in the scratchpad,
     never the repo. Date-dependent output: capture before and after **the same day**, or take a
     same-day baseline from the last commit via a temporary `git worktree`.
4. **Refactor in groups** — dead code, then duplication, then comments/docs. Run tests + typecheck
   after each group. Follow coding-scope-discipline and coding-native-code.
5. **Diff the golden.** Data JSON must be identical (minus fields you intentionally removed).
   HTML may differ only by expected noise (removed classes, framework text-node markers). Any
   other diff is a regression until explained.
6. **Review.** Run codereview-antipatterns + codereview-overengineering in parallel, then
   verify-e2e-complete. Verify reviewer claims (grep usages) before acting on them — they can be
   wrong.
7. **Commit** the cleanup as its own commit (with approval) *before* starting any follow-up fix,
   so work doesn't run together. Each follow-up fix gets its own commit.
8. **Report** — outcome first, then:
   - **What changed**: Speed / Dead code / Duplication / Tests / Docs (one line each)
   - **Not verified**: anything you couldn't exercise (e.g. write paths)
   - **New bugs found** (pre-existing, not fixed) and the ranked improvements list

## Guardrails

- **Never exercise write paths against real data** (DB writes, sheet writes, emails, payments)
  without explicit approval. Offer a copy/staging target instead.
- **Secrets**: read them from env files without echoing. Every subagent prompt must say "never
  print secret values" — and scan the agent's report before relaying it; if it leaked one, tell
  Frank (without repeating it).
- Before committing: staged diff contains no `.env*`, no secret values (grep for the actual
  values, not just patterns).
- Don't delete files you only verified in one place — grep the whole repo first.

## Red flags

- "This is basically a bug fix, I'll slip it in" → improvements list.
- Refactoring before the characterization tests are green.
- A golden diff you're explaining away instead of investigating.
- One giant commit mixing cleanup and fixes.
