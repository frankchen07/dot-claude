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
# Install (per repo):
#   cp pre-push-secret-scan.sh /path/to/repo/.git/hooks/pre-push
#   chmod +x /path/to/repo/.git/hooks/pre-push
#
# Escape hatch for confirmed false positives: git push --no-verify
#
# git calls pre-push hooks with lines on stdin:
#   <local ref> <local sha1> <remote ref> <remote sha1>
# one line per branch/tag being pushed. No arguments.

set -euo pipefail

ZERO="0000000000000000000000000000000000000000"

PATTERNS='AKIA[0-9A-Z]{16}'
PATTERNS="$PATTERNS|-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----"
PATTERNS="$PATTERNS|sk_live_[0-9a-zA-Z]{10,}"
PATTERNS="$PATTERNS|xox[baprs]-[0-9a-zA-Z-]{10,}"
PATTERNS="$PATTERNS|[Bb]earer [A-Za-z0-9._-]{20,}"
PATTERNS="$PATTERNS|[a-zA-Z][a-zA-Z0-9+.-]*://[^:/[:space:]]+:[^@/[:space:]]+@"
PATTERNS="$PATTERNS|(api[_-]?key|secret|token|passwd|password)[[:space:]]*[:=][[:space:]]*[A-Za-z0-9/+_.-]{12,}"

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
    MATCHES=$(git show "$commit" 2>/dev/null | grep -E '^\+' | grep -vE '^\+\+\+' | grep -E "$PATTERNS" || true)
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
  echo "False positive? Override with: git push --no-verify" >&2
  exit 1
fi

exit 0
