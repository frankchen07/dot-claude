#!/bin/bash
# audit-nudge: Stop hook that enforces the audit-session-summary skill.
# CLAUDE.md requires audit-session-summary before ending any turn that used a
# Skill or Agent, but that's pure prompt guidance with nothing checking it —
# it silently gets skipped after context compaction or under context pressure.
# This hook scans the session transcript for the last Skill/Agent tool_use
# and the last audit-session-summary invocation; if a Skill/Agent ran more
# recently than the audit, it blocks the stop and nudges the model to run it.
#
# Suppression ("no audit summary" / "audit summary on") is read from the same
# transcript the SKILL.md itself already scans, so state stays single-sourced.
#
# Install: Add to ~/.claude/settings.json hooks.Stop

set -euo pipefail

INPUT=$(cat)

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT_PATH=$(echo "$INPUT" | jq -r '.transcript_path // empty')

if [ -z "$SESSION_ID" ]; then
  exit 0
fi

STATE_DIR="${HOME}/.claude/audit-nudge/state"
mkdir -p "$STATE_DIR"

if command -v sha256sum >/dev/null 2>&1; then
  SESSION_HASH=$(echo -n "$SESSION_ID" | sha256sum | cut -c1-16)
else
  SESSION_HASH=$(echo -n "$SESSION_ID" | shasum -a 256 | cut -c1-16)
fi

ATTEMPT_FILE="${STATE_DIR}/${SESSION_HASH}-attempts"
ATTEMPTS=$(cat "$ATTEMPT_FILE" 2>/dev/null || echo 0)
ATTEMPTS=${ATTEMPTS:-0}

# Loop guard: never block more than twice in a row for the same lull.
if [ "$ATTEMPTS" -ge 2 ]; then
  echo 0 > "$ATTEMPT_FILE"
  exit 0
fi

# Resolve transcript file — prefer the path the hook was given, fall back to
# the same cwd-hash lookup SKILL.md documents for its own compaction fallback.
if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  PROJECT_DIR="${HOME}/.claude/projects/$(pwd | sed 's/[\/.]/-/g')"
  TRANSCRIPT_PATH=$(ls -t "$PROJECT_DIR"/*.jsonl 2>/dev/null | head -1 || echo "")
fi

if [ -z "$TRANSCRIPT_PATH" ] || [ ! -f "$TRANSCRIPT_PATH" ]; then
  exit 0
fi

# Suppression check: last matching phrase in user turns wins.
SUPPRESSED=$(jq -r '
  select(.message.role == "user") | .message.content
  | if type == "string" then .
    elif type == "array" then (map(select(.type=="text") | .text) | join(" "))
    else empty end
' "$TRANSCRIPT_PATH" 2>/dev/null | awk '
  BEGIN { state = 0 }
  tolower($0) ~ /no audit summary|skip the audit|dont do the audit|do not do the audit/ { state = 1 }
  tolower($0) ~ /audit summary on|resume the audit/ { state = 0 }
  END { print state }
')

if [ "$SUPPRESSED" = "1" ]; then
  echo 0 > "$ATTEMPT_FILE"
  exit 0
fi

# Usage check: classify each Skill/Agent tool_use in transcript order, take
# the last one. "OTHER" after the last "AUDIT" means the audit is stale.
LAST_EVENT=$(jq -c 'select(.message.content != null) | .message.content[]? | select(.type=="tool_use" and (.name=="Skill" or .name=="Agent")) | {name, skill: .input.skill}' "$TRANSCRIPT_PATH" 2>/dev/null \
  | jq -r 'if .name=="Skill" and .skill=="audit-session-summary" then "AUDIT" elif .name=="Skill" or .name=="Agent" then "OTHER" else empty end' \
  | tail -1)

if [ "$LAST_EVENT" = "OTHER" ]; then
  ATTEMPTS=$((ATTEMPTS + 1))
  echo "$ATTEMPTS" > "$ATTEMPT_FILE"
  jq -cn '{"decision":"block","reason":"You used a Skill or Agent this turn without running audit-session-summary yet. Invoke the audit-session-summary skill now, then you can stop."}'
  exit 0
fi

echo 0 > "$ATTEMPT_FILE"
exit 0
