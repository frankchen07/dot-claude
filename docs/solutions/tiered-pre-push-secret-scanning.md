# Tiering a pre-push secret scanner so it stops crying wolf

**Date**: 2026-09-29

## The problem

`git push` was blocked by `.git/hooks/pre-push` on a line in
`skills/setup-claude-mcp-connector/SKILL.md`:

```ts
const token = header.startsWith("Bearer ") ? header.slice(7) : "";
```

Documentation showing the *correct* env-var pattern — no credential anywhere. It
matched the hook's weakest rule,
`(api_key|secret|token|passwd|password)\s*[:=]\s*[A-Za-z0-9/+_.-]{12,}`, on the
substring `token = header.startsWith`.

The real cost of this isn't the one blocked push. A scanner that fires on prose
teaches you that its output is noise, and the muscle memory becomes
`git push --no-verify` — which waives the check on *every* commit in the push,
including the one that actually has an AWS key in it. A false-positive-prone
scanner is worse than no scanner, because it manufactures consent for the
bypass.

## The solution / decision

Split the flat pattern list into confidence tiers, in
`skills/coding-git-priv-pub/pre-push-secret-scan.sh`:

- **HIGH** — shapes never legitimately literal in source (`AKIA…`, private key
  headers, `sk_live_…`, `xox[baprs]-…`, raw JWT). Nothing suppresses these.
- **WEAK** — bearer headers, `scheme://user:pass@host` URLs, generic <!-- pragma: allowlist secret -->
  `token = …` assignments. Suppressible, because they match honest code and docs
  constantly.
- **BENIGN** — a marker on the same line that clears a WEAK hit: `process.env`,
  `os.environ`, `getenv`, `ENV[`, `$VAR`, `<angle-bracket-placeholder>`,
  `xxxxxxxx`, `your_`, `PLACEHOLDER`, `REDACTED`, `CHANGEME`, and an explicit
  `pragma: allowlist secret`.
- **CODEVAL** — an assignment whose *value* matches
  `^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_]` is a property access, not a credential.
  This is what clears the line above.

Two judgment calls worth keeping:

1. **A bare `example` / `placeholder` was tested and rejected** from BENIGN. It
   suppressed a genuine `postgres://admin:s3cr3tP4ssw0rd@db.example.com/app` <!-- pragma: allowlist secret -->
   through the *hostname*. Placeholder-ness has to be established by shape
   (`<user>`, `$VAR`, `xxxx`) or an explicit pragma, never by an English word
   that also appears in reserved domains.
2. **Raw JWT went into HIGH specifically to protect CODEVAL.** A JWT's
   `header.payload` shape is indistinguishable from a property access, so
   without a HIGH rule catching it first, CODEVAL would have swallowed real
   tokens. Every suppression rule needs this question asked of it: what real
   secret has the shape I just declared benign?

Also fixed a real pre-existing gap found while in there: the assignment pattern
demanded an alphanumeric immediately after `[:=]`, so it hit the quote character
and **missed every quoted secret** — `password = "hunter2correcthorsebattery"` <!-- pragma: allowlist secret -->
and `api_key: AIzaSy…` both sailed through the old hook. An optional `["']?`
closes it. The tiered version is strictly stronger than the flat one it replaced,
not a loosening.

## Why it wasn't obvious

- **The scanner trips over its own documentation.** Once the hook's comments
  explained *why* the quote is load-bearing, they contained
  `password = "hunter2…"`; once they explained the rejected alternative, they
  contained `postgres://admin:s3cr3t@db.example.com/app`. The tool's own source <!-- pragma: allowlist secret -->
  and docs are the densest concentration of secret-shaped-but-fake strings in
  the repo, so a per-line opt-out isn't a nicety — the tool needs it to describe
  itself. In prose, prefer `scheme://<user>:<pass>@host` over
  `scheme://user:pass@host`: it reads better *and* self-clears via the <!-- pragma: allowlist secret -->
  angle-bracket rule.
- **First regex draft failed 3 of 15 cases**, and two failures were invisible
  without a test table: it still blocked the target line (the `process.env`
  marker was on the *next* line, not the flagged one), and it let
  `password = "hunter2…"` through. Build the false-positive/true-positive case
  table *before* editing the patterns, and run it against the real function —
  not a copy pasted into the test — by `awk`-ing the script up to its main loop
  and sourcing that:
  ```bash
  awk '/^FOUND=0$/{exit} {print}' pre-push-secret-scan.sh > hooklib.sh
  . hooklib.sh && printf '%s\n' "$line" | scan_added_lines
  ```
- **`git push --dry-run` runs the pre-push hook.** That's the real end-to-end
  gate, and it costs nothing — no need to reason about whether the hook
  self-triggers on its own embedded patterns, just run it.
- **Two copies of the hook exist and silently diverge.** Canonical tracked copy
  at `skills/coding-git-priv-pub/pre-push-secret-scan.sh`, live untracked copy
  at `.git/hooks/pre-push`. Editing only the live one makes the fix invisible to
  the repo and to every other repo installing from the skill. Always edit the
  tracked one, then `cp` + `chmod +x`, then `diff` to confirm.
- **`set -euo pipefail` plus `grep` is a trap.** `grep` exits 1 on no-match,
  which under `pipefail` kills the hook mid-scan and silently reports "clean".
  Every grep in a pipeline needs `{ grep … || true; }`.

## Pointers

- `skills/coding-git-priv-pub/pre-push-secret-scan.sh` — the hook; `HIGH` /
  `WEAK_INLINE` / `ASSIGN` / `BENIGN` / `CODEVAL` and `scan_added_lines()`
- `skills/coding-git-priv-pub/SKILL.md` — step 9 documents the tiers and the
  pragma-over-`--no-verify` preference
- `README.md` — the `pre-push-secret-scan.sh` section
- Install / reinstall:
  `cp skills/coding-git-priv-pub/pre-push-secret-scan.sh .git/hooks/pre-push && chmod +x .git/hooks/pre-push`
- Verify: `git push --dry-run` (expect exit 0, no output)
- Regression-guard a change to the patterns on a throwaway branch, so `main` and
  the remote are never involved:
  ```bash
  git checkout -b tmp-scan-test && printf 'password = "hunter2correcthorsebattery"\n' > .t  # pragma: allowlist secret
  git add -f .t && git commit -qm t && git push --dry-run origin tmp-scan-test   # must exit 1
  git checkout main && git branch -D tmp-scan-test && rm .t
  ```

## Related: dropping scratch from an unpushed commit

The same session found `daemon.lock`, `daemon.status.json`, and
`feedback/drafts/*.json` about to go public (PIDs, local absolute paths, private
project names, request IDs). `.gitignore` had `daemon/` — the *directory* — and
nothing for the sibling `daemon.*` files at the repo root. Worth re-checking
whenever a rule is written for a directory: is there a same-named file, or
siblings sharing the prefix, sitting beside it?

Because the commit was unpushed, `git rm --cached <files>` + `git commit --amend`
was enough — the additions vanish from the commit with no history rewrite and no
force-push, and `--cached` leaves every file on disk. That only works pre-push;
once published it's `coding-git-history` / `git filter-repo` territory.
