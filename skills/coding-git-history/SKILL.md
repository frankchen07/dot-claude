---
name: coding-git-history
description: Use when a large binary, secret, or file that shouldn't be tracked has been committed to git — deleting it going forward isn't enough since it stays in history and (if pushed) on the remote. Triggers: remove file from git history, accidentally committed large file, purge secret from git, repo size bloat, .gitignore didn't catch it, "erase from that commit".
---

# Git History Cleanup

## Overview

Git keeps full history. A new commit that deletes a file only stops *future*
tracking — the file is still completely present and downloadable from every
prior commit, and if that history was pushed, from the remote too. A large
binary or a secret needs an actual history rewrite, not a follow-up delete
commit.

## Process

1. **Find the full blast radius before touching anything.**
   `git log --all --oneline -- <path>` (add `--stat` to see size/commits).
   Know every commit that touched the file first — don't assume it's just
   the one you remember.

2. **Confirm a clean working tree.** `git status --short`. History-rewrite
   tools assume this; uncommitted work can get lost or confuse the rewrite.

3. **Use `git filter-repo`**, not `git filter-branch` (slow, semi-deprecated)
   or BFG (needs Java) — `filter-repo` is the current recommended tool:
   ```
   git filter-repo --path <path> --invert-paths --force
   ```
   `--force` is required when running against your actual repo rather than
   a throwaway fresh clone.

4. **Critical gotcha: this rewrites the working tree, not just history.**
   Any local copy of the file that only existed because it was tracked
   *disappears from disk*, not just from git. Before running it:
   - Make sure there's an independent copy of the file outside the repo, **or**
   - Know that if you haven't pushed the rewrite yet, the original is still
     recoverable from the remote — `git fetch origin` then
     `git show origin/<branch>:<path> > <path>` — but only until the remote
     gets overwritten.
   Don't skip this check because the tool exits with no errors; "finished
   successfully" and "nothing was lost" are different claims.

5. `filter-repo` removes the `origin` remote as a safety brake. Re-add it
   (`git remote add origin <url>`) before pushing.

6. **Two-phase safety model — treat them as two different confirmations:**
   - The **local rewrite is recoverable** (re-clone, or re-fetch from the
     still-untouched remote) right up until you push.
   - The **force-push is the actual point of no return.** Get explicit
     confirmation on this step specifically, even if the user already asked
     for "help cleaning up the repo" in general terms — that request
     authorized the cleanup, not necessarily the irreversible remote
     overwrite.

7. Push with `--force-with-lease`, not plain `--force` — it fails safely if
   the remote changed unexpectedly since your last fetch instead of blindly
   clobbering whatever's there.

8. **Verify, don't just trust exit codes:**
   - `git fetch origin` then `git log origin/<branch> --all -- <path>` is
     empty.
   - `.git` directory size actually shrank (`du -sh .git`) — a concrete
     signal, not just "the command didn't error."

9. **Fix the root cause so it can't recur.** Add the file/pattern to the
   **repo's own `.gitignore`**, not just a personal global gitignore
   (`core.excludesFile` / `~/.gitignore_global`). A global gitignore only
   protects the one machine it's configured on — anyone else who clones the
   repo (or you, on another machine) has zero protection and can
   re-commit the exact same file with no warning.

## When it's not the right tool

If the large file genuinely needs to stay version-controlled (not a
throwaway local fixture), the answer is Git LFS, not purging it — don't
reflexively strip something that should have been LFS-tracked instead.

## Rationalizations — stop and check

| Thought | Reality |
|---|---|
| "It's already gitignored on my machine, so it's fine" | Check whether that's the repo's own `.gitignore` or your personal global config. If global, nobody else cloning the repo is protected. |
| "I'll just delete it in a new commit" | That only stops future tracking. The file is still fully present and downloadable from every commit before that one. |
| "filter-repo finished with no errors, so I'm done" | Check whether it altered the working tree, not just history — confirm no needed local-only files vanished before moving on. |
| "They already said 'help me clean this up,' so I can force-push" | That authorized the cleanup. Force-pushing over shared/remote history is a separate, irreversible action — confirm it explicitly. |

## Red Flags

- About to run a history-rewrite tool without first listing every commit
  that touched the path
- About to force-push without having force-with-lease'd or without a fresh
  fetch to compare against
- A file that only existed in git history is also the only copy that
  existed anywhere — rewriting will delete it for real
- Relying on a personal/global gitignore to protect a shared repo
