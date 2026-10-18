---
name: audit-session-summary
description: Use before ending any turn that used a Skill or Agent — right before ExitPlanMode when planning, right before output-do-the-work otherwise. Invoke it WITH args — one `name: outcome` pair per Skill and Agent used this turn, `;`-separated, each outcome ≤6 words (e.g. `output-prove-it: 139/139 tests green; verify-e2e-complete: passed, 1 gap fixed`). The turn-card mod draws them on its end-of-turn card. Say "no audit summary" to suppress for the rest of the session, "audit summary on" to resume.
---

The turn-card mod (`~/.claude/mods/turn-card`) records the facts itself: which skills, agents and tools ran, time, cost and tokens. Its Stop hook is what reminds you to run this skill. Your only job is the outcome notes, passed as this skill's `args`.

## What to do

0. **Suppression check.** If, earlier in this session, the user said something to the effect of "no audit summary" / "skip the audit" / "don't do the audit summary," and has not since said something to the effect of "audit summary on" / "turn it back on" / "resume the audit summary" — stop here.
1. **No-op check.** If no Skill and no Agent was invoked during the turn, stop here.
2. **Args check.** If you invoked this skill without `args`, invoke it once more with them: `name: outcome; name: outcome`, covering each Skill (except this one) and each Agent used this turn.
   - For an agent, use its `description` or `subagent_type` as the name.
   - Keep each outcome to ≤6 words, and reflect what actually happened. For an agent, use what it reported, not a generous paraphrase.
3. Print nothing about skills or agents in your reply. The card shows them. Exception: if the card is off (`/turncard` said "Turn Card off") or the user says they can't see it, also print one line per item: `- name — outcome`.

If context was compacted and you can't recall what ran, read the transcript instead of guessing:
```bash
jq -c 'select(.message.content != null) | .message.content[]? | select(.type=="tool_use" and (.name=="Skill" or .name=="Agent")) | {name, input}' \
  "$(ls -t ~/.claude/projects/$(pwd | sed 's/[/.]/-/g')/*.jsonl | head -1)"
```
