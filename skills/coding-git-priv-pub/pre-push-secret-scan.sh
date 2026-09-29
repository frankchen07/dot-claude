#!/bin/bash
# pre-push-secret-scan.sh — git pre-push hook: blocks pushes whose new
# commits contain secret-shaped strings (API keys, private key headers,
# Bearer tokens, embedded connection-string credentials, generic
# token/password assignments).
#
# This is a real git hook, not a Claude Code hook — it fires on any push
# (terminal, IDE, Claude Code, CI) once installed, which is the point: it
# catches the *next* accidental secret commit, not just the one a manual
# audit already found.
#
# Patterns are split by confidence, because a single flat pattern list makes
# the hook cry wolf on documentation and then trains you to reach for
# --no-verify reflexively:
#
#   HIGH  — shapes that are never legitimately a literal in source. Nothing
#           suppresses these.
#   WEAK  — bearer headers, credential URLs, and generic `token = ...`
#           assignments. These match plenty of honest code and docs, so a
#           BENIGN marker on the same line clears them (env-var indirection,
#           an obvious placeholder, or an explicit opt-out pragma), and an
#           assignment whose value reads as code is cleared by CODEVAL.
#
# Install (per repo):
#   cp pre-push-secret-scan.sh /path/to/repo/.git/hooks/pre-push
#   chmod +x /path/to/repo/.git/hooks/pre-push
#
# Escape hatches, in order of preference:
#   1. Add `pragma: allowlist secret` in a comment on the offending line —
#      narrow, reviewable, and survives in the diff for the next reader.
#   2. git push --no-verify — overrides the entire push. Read the actual
#      match first; this is the blunt instrument.
#
# git calls pre-push hooks with lines on stdin:
#   <local ref> <local sha1> <remote ref> <remote sha1>
# one line per branch/tag being pushed. No arguments.

set -euo pipefail

ZERO="0000000000000000000000000000000000000000"

# --- HIGH: unambiguous credential shapes, never suppressed -----------------
HIGH='AKIA[0-9A-Z]{16}'
HIGH="$HIGH|-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"
HIGH="$HIGH|sk_live_[0-9a-zA-Z]{10,}"
HIGH="$HIGH|xox[baprs]-[0-9a-zA-Z-]{10,}"
# Raw JWT. Lives in HIGH specifically so CODEVAL's `identifier.property`
# suppression below can never swallow one (a JWT's `header.payload` shape
# looks exactly like a property access).
HIGH="$HIGH"'|eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}'

# --- WEAK: heuristics, suppressible ---------------------------------------
# Raw credential material appearing inline. Reported even when the line also
# contains a code-shaped assignment.
WEAK_INLINE='[Bb]earer [A-Za-z0-9._-]{20,}'
WEAK_INLINE="$WEAK_INLINE|[a-zA-Z][a-zA-Z0-9+.-]*://[^:/[:space:]]+:[^@/[:space:]]+@"

# Generic "<credential-word> = <opaque value>". The optional quote is
# load-bearing: without it a quoted secret slips through, because the character
# right after `=` is the quote rather than the secret itself — e.g.
# `password = "hunter2correcthorsebattery"` (pragma: allowlist secret).
ASSIGN='(api[_-]?key|secret|token|passwd|password)[[:space:]]*[:=][[:space:]]*["'"'"']?[A-Za-z0-9/+_=.-]{12,}'

WEAK="$WEAK_INLINE|$ASSIGN"

# --- Suppressors -----------------------------------------------------------
# Markers that make a WEAK hit legitimate. Deliberately NOT here: a bare
# "example" or "placeholder" — tested, and bare "example" suppressed a real
# credential URL through its own hostname:
# `postgres://admin:s3cr3t@db.example.com/app` (pragma: allowlist secret).
BENIGN='process\.env|os\.environ|getenv|ENV\[|\$\{?[A-Z_]{3,}'
BENIGN="$BENIGN"'|pragma: allowlist secret'
BENIGN="$BENIGN"'|[Xx]{8,}|<[A-Za-z_][A-Za-z0-9_ .-]*>'
BENIGN="$BENIGN"'|[Yy]our[_-]|PLACEHOLDER|REDACTED|CHANGEME'

# An assignment value shaped like `identifier.property` is code, not a
# credential — e.g. `const token = header.startsWith("Bearer ") ? ...`.
CODEVAL='^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_]'

# Reads added diff lines on stdin, writes reportable matches to stdout.
scan_added_lines() {
  local added high_hits weak_hits line val nval ncode

  added=$(cat)
  [ -z "$added" ] && return 0

  high_hits=$( { printf '%s\n' "$added" | grep -E "$HIGH" || true; } )
  [ -n "$high_hits" ] && printf '%s\n' "$high_hits"

  weak_hits=$( { printf '%s\n' "$added" | grep -E "$WEAK" || true; } \
             | { grep -vE "$BENIGN" || true; } )
  [ -z "$weak_hits" ] && return 0

  while IFS= read -r line; do
    [ -z "$line" ] && continue

    # Already reported as a HIGH hit — don't print it twice.
    if printf '%s\n' "$line" | grep -qE "$HIGH"; then
      continue
    fi

    # Inline credential material: report regardless of assignment shape.
    if printf '%s\n' "$line" | grep -qE "$WEAK_INLINE"; then
      printf '%s\n' "$line"
      continue
    fi

    # ASSIGN-only line: suppress when every extracted value reads as code.
    val=$( { printf '%s' "$line" | grep -oE "$ASSIGN" || true; } \
         | sed -E 's/^.*[:=][[:space:]]*["'"'"']?//' )
    if [ -n "$val" ]; then
      nval=$( { printf '%s\n' "$val" | grep -c . || true; } )
      ncode=$( { printf '%s\n' "$val" | grep -cE "$CODEVAL" || true; } )
      [ "$nval" = "$ncode" ] && continue
    fi

    printf '%s\n' "$line"
  done <<< "$weak_hits"
}

FOUND=0

while read -r local_ref local_sha remote_ref remote_sha; do
  [ -z "${local_sha:-}" ] && continue
  [ "$local_sha" = "$ZERO" ] && continue  # deleting a ref — nothing to scan

  if [ "$remote_sha" = "$ZERO" ]; then
    # New branch/tag on the remote — scan everything not already reachable
    # from any known remote-tracking ref. Can be slow on a large first push
    # of full history; that's the correct tradeoff (it's exactly the case
    # a history rewrite + force-push needs covered).
    COMMITS=$(git rev-list "$local_sha" --not --remotes 2>/dev/null || echo "$local_sha")
  else
    COMMITS=$(git rev-list "${remote_sha}..${local_sha}" 2>/dev/null || true)
  fi

  [ -z "$COMMITS" ] && continue

  for commit in $COMMITS; do
    MATCHES=$(git show "$commit" 2>/dev/null \
      | grep -E '^\+' | grep -vE '^\+\+\+' \
      | scan_added_lines || true)
    if [ -n "$MATCHES" ]; then
      echo "pre-push-secret-scan: possible secret in commit $commit (pushing $local_ref):" >&2
      echo "$MATCHES" | sed 's/^/  /' >&2
      FOUND=1
    fi
  done
done

if [ "$FOUND" = "1" ]; then
  echo "" >&2
  echo "pre-push-secret-scan: blocking push — review the matches above." >&2
  echo "False positive? Prefer a narrow 'pragma: allowlist secret' comment on" >&2
  echo "the offending line. Whole-push override: git push --no-verify" >&2
  exit 1
fi

exit 0
