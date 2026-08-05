---
name: audit-session-summary
description: Use right before ExitPlanMode and right before ending-do-the-work — prints a brief list of which Skills and Agents were used in that phase, why, and the outcome.
---

Print a short, scannable status readout of tooling used in the phase that just finished (planning, or coding). Not a report — a status line per item.

## What to do

1. Walk back through the current phase (since the last time this skill fired, or since the turn started if it hasn't fired yet) and list every Skill and Agent invocation, in the order used. Dedupe repeats by name with a count (e.g. "Explore ×2").
2. For each **Skill**: one line — name, why it was reached for, what happened after following it. This comes from your own in-context memory of the turn; you were the one who invoked it.
3. For each **Agent**: one line — subagent_type/description, why it was spawned, outcome. Draw the outcome from the summary message it actually returned (already in your context) — don't paraphrase generously, reflect what it reported.
4. If context was compacted and you can't reliably reconstruct the phase's history from memory, fall back to reading the current session transcript instead of guessing:
   ```bash
   jq -c 'select(.message.content != null) | .message.content[]? | select(.type=="tool_use" and (.name=="Skill" or .name=="Agent")) | {name, input}' \
     ~/.claude/projects/$(pwd | sed 's/[/.]/-/g')/${SESSION_ID}.jsonl
   ```
   The transcript directory is `~/.claude/projects/<cwd-with-slashes-and-dots-turned-to-dashes>/`, one `.jsonl` file per session (find the current one by most recent mtime if `$SESSION_ID` isn't known). Each `tool_use` block with `name:"Skill"` has `input:{skill, args}`; each with `name:"Agent"` has `input:{description, subagent_type, prompt}` — pair it with the following `tool_result` for the outcome.
5. Output exactly two sections, each entry one line, no tables:

   ```
   ## Skills used
   - <name> — why: <reason> — outcome: <result>

   ## Agents used
   - <subagent_type/description> — why: <reason> — outcome: <result>
   ```

   If a section is empty, write one line ("No skills used this phase.") instead of an empty header.

Keep the whole thing short enough to read in one glance — this is a status readout, not documentation.
