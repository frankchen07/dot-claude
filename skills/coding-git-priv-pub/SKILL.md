---
name: coding-git-priv-pub
description: Use before making any private repo public, open-sourcing a project, or sharing dotfiles/config/skills publicly — audits for secrets, PII, and business/personal-sensitive content (including stuff already sitting in git history), decides what to delete/anonymize/exclude, and hands off to coding-git-history for the actual purge. Triggers: make this public, open source this, share my dotfiles, is this safe to publish, flip repo visibility, publish my skills/agents.
---

# Making a Repo Safe to Publish

## Overview

This is the audit-and-decide layer, not the mechanics layer. Once you know
what needs to be purged from git history, hand off to `coding-git-history`
for the actual `filter-repo` / backup-tag / force-with-lease work — don't
duplicate that here. This skill is about finding everything that needs
purging or anonymizing in the first place, including content that's easy to
miss because it doesn't look sensitive at a glance.

## Process

1. **Reality check first.** Is this repo already pushed anywhere?
   `git remote -v`, then `git log <branch> --oneline` vs
   `git log origin/<branch> --oneline` (or `git rev-list --left-right --count
   <branch>...origin/<branch>`). If local and remote already match, whatever
   is committed is already sitting on the remote under its *current*
   visibility — don't treat "haven't pushed yet" as the safety net without
   checking. Current visibility (public vs. private) changes urgency, not
   whether remediation is needed — a private repo you're about to flip
   public still needs the same audit, just without the "already exposed"
   panic.

2. **Audit — don't rely on filenames.** Run the checklist below. Filename
   skimming is fine for a first-pass triage (obviously-generic vs.
   obviously-personal), but any directory that accumulates working notes
   over time (planning scratch, memory/notes dirs, session logs) needs an
   actual content pass before you decide anything — auto-generated or
   innocuous-looking filenames say nothing about what ended up inside them.
   Split the audit across parallel Explore agents when the repo is
   nontrivial: one pass for git-tracked files + full history for
   credential-shaped strings, a separate pass for personal/business content
   review. Don't skip the history pass — `git grep` only sees the current
   tree; a secret added and later "deleted" is still in every commit before
   the delete.

3. **Check every path a sensitive file was ever renamed from — not just its
   current path.** `git filter-repo --path <path> --invert-paths` matches
   the *exact string* given; it has no idea a file used to live somewhere
   else. A rename (`skills/dealmaker` → `skills/comms-dealmaking`,
   `agent-memory/quality-control-enforcer` → `agent-memory/codereview-antipatterns`)
   leaves the old path's commits completely untouched by a purge scoped to
   the new path — the PII is still fully reachable in history, just under a
   name nobody thought to check. Build the full list of paths that ever
   existed and diff it against what's currently tracked, then sweep every
   path only in the "ever existed" side for the same sensitive patterns:
   ```bash
   git log --all --name-only --pretty=format: | sort -u | grep -v '^$' > /tmp/all_paths_ever.txt
   git ls-files | sort > /tmp/current_paths.txt
   comm -23 /tmp/all_paths_ever.txt /tmp/current_paths.txt   # renamed-away or deleted paths
   ```
   Then grep each of those paths' full history (`git log --all -p -- <path>`,
   added lines only) for the same PII/secret patterns used elsewhere in this
   process. Do this even after a purge you're confident in — it's exactly
   the kind of gap that survives a first pass because the current tree looks
   clean.

4. **Decide per finding**: delete / anonymize-and-keep / exclude-going-forward.
   Heuristic for directories: if a large fraction of what you actually
   reviewed turned out sensitive, don't hand-curate a keep-list — exclude
   the whole directory. Cherry-picking "safe" files out of a mostly-sensitive
   directory is more error-prone than just drawing the line at the directory
   level, and the safe ones usually weren't the point of publishing anyway.

5. **Anonymize-and-keep has one nuance `coding-git-history` doesn't cover**:
   if a file needs to stay at its current path but its *old* content
   (name, email, comp figures, whatever) must not be reachable in history,
   the path has to be purged from all history first — then the sanitized
   replacement goes in as a **new commit made after filtering completes**,
   not before. Committing the sanitized version first and then running
   `filter-repo --path <path> --invert-paths` removes the path — old *and*
   new content — from everything, tip included.

6. **Any live-looking credential gets rotated**, independent of the git
   work. Check whether it's actually consumed by something (grep the repo
   and any related running processes for the filename/value) before
   assuming manual rotation is required — some tokens are daemon-managed
   ephemeral state that regenerates on its own once the stale file is gone.

7. **Purge via `coding-git-history`.** Follow that skill's process exactly:
   blast-radius check, backup tag, `git filter-repo --path ... --invert-paths
   --force`, re-add `origin`, `--force-with-lease`, explicit confirmation
   before the actual push. Pass every path found in step 3 alongside the
   current ones in the same `filter-repo` invocation — don't split them
   into separate runs unless you have to; `filter-repo` warns about
   "continuation" runs against an already-rewritten repo and needs an
   explicit yes to proceed sanely.

8. **Verify against a fresh clone, not local state.** Local checks after a
   force-push can't see what the server actually has. Clone the remote fresh
   into a throwaway directory and re-run the grep / `git log --all -- <path>`
   checks there — including the step-3 renamed-path sweep again, on the
   fresh clone, not just the paths you already fixed.

9. **Install the prevention hook going forward** — `pre-push-secret-scan.sh`
   in this skill's directory. Copy it to `.git/hooks/pre-push` in the target
   repo (`chmod +x`) so future pushes — from Claude Code, a terminal, or an
   IDE — get scanned automatically, not just this one cleanup pass. Expect
   occasional false positives on legitimate env-var-based connection strings
   (`postgres://$USER:$PASSWORD@host`) — verify by reading the actual match
   before reaching for `--no-verify`, don't reach for it reflexively.

## What tends to sneak in (recurring checklist — re-run periodically, not just once)

- **Personal-use skills/agents/scripts hardcode identity by default.**
  Anything written for yourself first tends to bake in name, email, handles,
  precise location, schedule. Fine to keep for personal use; needs a
  template pass (strip identity, keep the mechanics) before sharing.
- **Scratch/planning directories drift sensitive over time.** A directory
  that started as generic technical notes can end up holding real business
  operations detail (client names, deal terms, SOPs, pricing) or personal
  infrastructure detail (device names, VPN topology, home server IPs) —
  nobody decided to put it there, it just accumulated.
- **Named third parties show up in slugs, not just prose.** A project or
  file *name* itself can identify a real person or company even when the
  file body is generic technical content.
- **Personal home/network infrastructure is a security exposure, not just
  a privacy one.** Device names, VPN topology, self-hosted server IPs
  reveal attack surface. Treat this category as higher severity than
  generic PII.
- **Runtime/ephemeral state directories sit outside `.gitignore`'s notice
  until something looks.** Any tool (including Claude Code itself) that
  starts writing local runtime state — PIDs, session IDs, control tokens,
  absolute local paths — is a candidate for silently getting tracked before
  anyone adds an ignore rule for it.
- **Integration/MCP configs are clean by convention, not guarantee.** A
  config that references external files or env vars today can become a
  config with an inline token tomorrow if someone wires up a new
  integration quickly.
- **No blanket protection for pasted artifacts.** Screenshots, exports, or
  a live key copy-pasted into a note while debugging a real incident aren't
  caught by any pattern-based check — these need a human look.
- **Session transcripts / auto-memory are the single highest-density risk
  category.** If these are gitignored, that's the one rule to never
  accidentally weaken (no negation patterns, no `git add -f`, no scope
  narrowing).

## Rationalizations — stop and check

| Thought | Reality |
|---|---|
| "The directory name is generic/auto-generated, so it's probably safe" | Auto-generated names say nothing about accumulated content. Read a representative sample before trusting it. |
| "It's a private repo, so I don't need to rush" | Fine short-term, but do the audit now as prep, not right before flipping visibility — "I'll deal with it later" is how a leaked token sits in history for months. |
| "I'll just delete the two files with personal info" | If it's a directory that accumulates working notes, check the base rate across the whole directory first — two flagged files often means the pattern repeats. |
| "It's just a hex string, probably not important" | Assume anything token-shaped is live until you've confirmed otherwise. Rotate/neutralize regardless of what git status says about it. |
| "It pushed with no errors, must be clean" | Verify against a fresh clone of the remote, not local state — local checks can't see what the server actually has. |
| "I already anonymized the file, ready to commit" | Check whether the *old* content is still reachable in history before calling it done — editing a tracked file doesn't remove its prior committed versions. |
| "I purged the file at its current path, so it's out of history" | Only if it was never renamed. Diff every-path-ever-tracked against current tracked paths and check the difference — a rename hides old commits from a path-scoped purge completely. |

## Red Flags

- About to flip a repo public without checking whether scratch/planning or
  memory/notes directories are tracked
- A directory's tracked file count is much larger than what was actually
  content-reviewed (as opposed to filename-skimmed)
- Anonymizing a file's current content and committing without checking
  whether the pre-anonymization version is still reachable via
  `git log --all -- <path>`
- Treating "it's private" as a permanent state rather than "not yet audited
  for going public"
- Skipping the pre-push hook install because "this one push is fine" — the
  whole point is catching the *next* one, not this one
- A purged file's skill/agent/directory has ever been renamed and the old
  path wasn't independently checked

## See also

- `coding-git-history` — the actual `git filter-repo` / backup / force-push
  mechanics. This skill decides *what* needs purging; that one does the
  purging.
- `pre-push-secret-scan.sh` (this skill's directory) — install as
  `.git/hooks/pre-push` in the target repo for standing protection against
  the next accidental secret commit.
