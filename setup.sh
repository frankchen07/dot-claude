#!/usr/bin/env bash
# Per-machine setup git can't carry. Run after cloning or pulling to ~/.claude; safe to re-run.
set -euo pipefail

cd "$(dirname "$0")"

command -v jq >/dev/null || echo "warning: jq not found, read-once hooks need it" >&2

cp skills/coding-git-priv-pub/pre-push-secret-scan.sh .git/hooks/pre-push
chmod +x .git/hooks/pre-push

# --scope local: the default writes an absolute path into the tracked settings.json
claude plugin marketplace add "$PWD/mods" --scope local
claude plugin marketplace add anthropics/claude-plugins-official --scope local
claude plugin install turncard@frank-mods --scope user
claude plugin install vercel@claude-plugins-official --scope user
