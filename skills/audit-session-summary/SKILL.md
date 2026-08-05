---
name: audit-session-summary
description: Use before ending any turn that used a Skill or Agent — right before ExitPlanMode when planning, right before output-do-the-work otherwise — prints a brief list of which Skills and Agents were used, why, and the outcome. Say "no audit summary" to suppress for the rest of the session, "audit summary on" to resume.
---

Print a short, scannable status readout of tooling used in the turn that just finished. Not a report — a status line per item.

## What to do

0. **Suppression check.** If, earlier in this session, the user said something to the effect of "no audit summary" / "skip the audit" / "don't do the audit summary," and has not since said something to the effect of "audit summary on" / "turn it back on" / "resume the audit summary" — stop here. Print nothing, don't mention that it was skipped.
1. **No-op check.** If no Skill and no Agent was invoked during the turn being summarized, stop here with no output. Don't print placeholder "none used" sections for a turn with nothing to report.
2. Walk back through the turn that just finished (since the last time this skill fired, or since the turn started if it hasn't fired yet) and list every Skill and Agent invocation, in the order used. Dedupe repeats by name with a count (e.g. "Explore ×2").
3. For each **Skill**: one line — name, why it was reached for, what happened after following it. This comes from your own in-context memory of the turn; you were the one who invoked it.
4. For each **Agent**: one line — subagent_type/description, why it was spawned, outcome. Draw the outcome from the summary message it actually returned (already in your context) — don't paraphrase generously, reflect what it reported.
5. If context was compacted and you can't reliably reconstruct the turn's history from memory, fall back to reading the current session transcript instead of guessing:
   ```bash
   jq -c 'select(.message.content != null) | .message.content[]? | select(.type=="tool_use" and (.name=="Skill" or .name=="Agent")) | {name, input}' \
     ~/.claude/projects/$(pwd | sed 's/[/.]/-/g')/${SESSION_ID}.jsonl
   ```
   The transcript directory is `~/.claude/projects/<cwd-with-slashes-and-dots-turned-to-dashes>/`, one `.jsonl` file per session (find the current one by most recent mtime if `$SESSION_ID` isn't known). Each `tool_use` block with `name:"Skill"` has `input:{skill, args}`; each with `name:"Agent"` has `input:{description, subagent_type, prompt}` — pair it with the following `tool_result` for the outcome.
6. Output exactly two sections, each entry one line, no tables:

   ```
   ## Skills used
   - <name> — why: <reason> — outcome: <result>

   ## Agents used
   - <subagent_type/description> — why: <reason> — outcome: <result>
   ```

   If one section is empty but the other has entries, write one line ("No skills used this turn.") instead of an empty header. (If *both* would be empty, step 1 already stopped you before reaching this point.)

Keep the whole thing short enough to read in one glance — this is a status readout, not documentation.
