# Turn Card

A Claude Code mod that draws a box above the prompt when a turn ends. The box lists what ran in the turn: skills, agents (with model and tokens), shell Stop hooks, tool counts, time, cost and tokens.

```
╭─────────────────────────────────────────────────────────────────────────╮
│ Turn 1  14.4s · $0.01 · 338k in · 752 out · context 6%                  │
│ Skills  explore-effective-efficiency — skill loaded                     │
│ Agents  Explore · probe (haiku, 18.1k) — returned ok                    │
│ Hooks   Stop: audit-nudge blocked 1× → passed                           │
│ Tools   Skill 2 · Agent 1 · Bash 1                                      │
╰─────────────────────────────────────────────────────────────────────────╯
```

The mod records the facts itself. The model adds only the short outcome after each "—", by invoking the `audit-session-summary` skill with `args` set to `name: outcome; name: outcome`.

## Install
Requires Claude Code 2.1.287 or later.

```bash
claude plugin marketplace add ~/.claude/mods
claude plugin install turn-card@frank-mods --scope user
```

For one session only: `claude --plugin-dir ~/.claude/mods/turn-card`. Type `/turncard` to hide or show the card.

## Where the numbers come from
- **Header:**
  - Time is wall clock from `turn.start`, so it includes Stop-hook re-runs.
  - Tokens come from `turn.complete`'s `usage`: "in" counts input plus cache reads and writes.
  - Cost is the change in `$.session.usage().cost.usd` since the last turn.
  - Context % comes from `$.session.usage().context`.
- **Skills, Agents and Tools:** from `tool.call`, which has the tool inputs flattened onto the event (`e.skill`, `e.args`, `e.subagent_type`, `e.description`).
  - An agent's model and id come from the tool result (`result.resolvedModel`, `result.agentId`).
  - Its tokens come from the subagent's own `turn.complete`. An async agent that finishes after the turn still fills them in.
- **Hooks:** mods can't see shell hooks. `~/.claude/audit-nudge/hook.sh` appends one JSON line per decision to `~/.claude/audit-nudge/state/hooks.jsonl` (`{ts, cwd, hook, event, result}`). The mod reads the last 50 lines and keeps those from this turn in this folder.
  - Any other shell hook can join by appending the same shape.

## Notes / limitations
- Mods run without Node's `process`, so the mod reads the hook log through `$.process.run` with bash expanding `$HOME`.
- Hook lines are matched by folder and time, not session (mods get no session id), so two sessions running at once in the same folder can show each other's hook runs.
- `gave up` means audit-nudge hit its two-block loop guard and let the turn end without the audit.
- It shows only the last turn. The band above the prompt holds one mod at a time.
- Agent notes are matched to the agent's description or type, ignoring case and a trailing "agent". A note under any other name doesn't show.

## Tests
`node --test ~/.claude/mods/turn-card/test/*.test.mjs` (the pure helpers in `hooks/card.mjs`).
