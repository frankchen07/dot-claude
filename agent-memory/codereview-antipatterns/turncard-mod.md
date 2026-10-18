---
name: turncard-mod
description: ~/.claude/mods/turncard: audit nudge via classic.Stop in the mod, /turns history in $.store (4 MiB cap), prune -> delete -> set with evict-and-retry
metadata:
  type: project
---

turncard mod (0.4.0, 2026-10-18) records skills/agents/tools from tool.call and draws the card; audit-session-summary args supply the outcome notes. The old shell Stop hook (audit-nudge/hook.sh + hooks.jsonl bridge) is retired and deleted; the nudge is now `on("classic.Stop")` returning `{block}` when the current turn has a Skill/Agent after the last notes call, max 2 blocks per turn, suppressed by "no audit summary" in turn.start text (saved per session).

Storage: `$.store` key `turns:<sessionId>` = {history, agentUsage, notesOff}. Store is ONE JSON file per plugin, `set` rejects past 4 MiB, keys() is insertion order. saveHistory prunes to 25 sessions, deletes then sets own key (moves it to end), and on a rejected set evicts the oldest other session and retries.

Known gaps (accepted): suppression typed mid-turn only applies next turn; NOTES_ON lacks "turn it back on"; nudge depends on the plugin being enabled. Unverified: two concurrent processes clobbering the whole-file store.

Intentional (don't flag): agentUsage passed to historyText so late async agents fill old turns; `$` never passed as a value / literal on(...) spelling (host static parse); catch{} around $.session.usage and store calls is deliberate best-effort; syncSession at turn.start (not session.start) because /clear and in-session resume fire no session.start; no agentId guard on classic.Stop (subagents fire SubagentStop).

**How to apply:** on future edits, check store size bounding and save ordering, agentId filtering on every handler, session-id keying.
