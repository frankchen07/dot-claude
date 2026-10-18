# Turn Card

A Claude Code mod that draws a box above the prompt when a turn ends. The box lists what ran in the turn: skills, agents (with model and tokens), tool counts, time, cost, tokens and context fill.

```
╭─────────────────────────────────────────────────────────────────────────╮
│ Turn 1  14.4s · $0.01 · context 60k / 1M (6%)                           │
│ Tokens  338k in: 301k cached (89%) · 37k new · 752 out                  │
│ Skills  explore-effective-efficiency — skill loaded                     │
│ Agents  Explore · probe (haiku, 18.1k) — returned ok                    │
│ Tools   Skill · Agent · Bash                                            │
╰─────────────────────────────────────────────────────────────────────────╯
```

The mod records the facts itself. The model adds only the short outcome after each "—", by invoking the `audit-session-summary` skill with `args` set to `name: outcome; name: outcome`.

## The notes nudge
The notes are the one thing the mod can't record, so its `classic.Stop` hook holds a turn open until they're there. If a Skill or Agent ran after the last `audit-session-summary` call, the stop is blocked with a reminder (`{ block }`, a settings Stop hook's `decision: block`).
- It gives up after two blocks in one turn, so it can't loop. The turn then ends with notes missing on some lines.
- Saying "no audit summary" (or "skip the audit") turns it off for the conversation, and "audit summary on" turns it back on. The setting is saved with the conversation's history.
- The notes skill itself doesn't count toward the Skills row or the Tools count.
- Where an organization manages Claude Code, `classic.*` hooks run only for plugins listed in managed settings.

## Install
Requires Claude Code 2.1.287 or later.

```bash
claude plugin marketplace add ~/.claude/mods
claude plugin install turn-card@frank-mods --scope user
```

For one session only: `claude --plugin-dir ~/.claude/mods/turncard`. Type `/turncard` to hide or show the card, and `/turns` to list every turn in this conversation, newest first. The history survives exiting and `claude --resume`.

## Where the numbers come from
- **Header:**
  - Time is wall clock from `turn.start`, so it includes the time a nudge adds.
  - Cost is the change in `$.session.usage().cost.usd` since the last turn.
  - Context comes from `$.session.usage().context`: tokens in the window now / window size (percent).
- **Tokens:** from `turn.complete`'s `usage`, summed over every model call in the turn. Each call resends the whole conversation, so "in" is often several times the context size.
  - "cached" is cache reads, which cost about a tenth of the full price. "new" is everything else, including cache writes.
- **Skills, Agents and Tools:** from `tool.call`, which has the tool inputs flattened onto the event (`e.skill`, `e.args`, `e.subagent_type`, `e.description`).
  - "×N" on a skill or tool means it ran N times. No number means once.
  - An agent's model and id come from the tool result (`result.resolvedModel`, `result.agentId`).
  - Its tokens come from the subagent's own `turn.complete`. An async agent that finishes after the turn still fills them in.

## Notes / limitations
- The card shows only the last turn, since the band above the prompt holds one mod at a time. `/turns` has the rest.
- `/turns` history is saved per conversation (by `$.session.id()`) in the mod's `$.store`, so it comes back when you resume that conversation. A new session or `/clear` starts empty. Only the 25 most recently used conversations are kept, and `--fork-session` starts fresh, since it gets a new id.
- Agent notes are matched to the agent's description or type, ignoring case and a trailing "agent". A note under any other name doesn't show.

## Tests
`node --test ~/.claude/mods/turncard/test/*.test.mjs` (`card.test.mjs`: the pure helpers in `hooks/card.mjs`; `persist.test.mjs`: the hooks driven by a fake `$`, for saved history and the nudge).
