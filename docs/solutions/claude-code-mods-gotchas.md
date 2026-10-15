# Claude Code mods: what the examples don't tell you

**Date**: 2026-10-14

## The problem
I built `mods/turn-card`, an end-of-turn card showing skills, agents, hooks, tokens and cost. The public examples (`anthropics/claude-code-playground/claude-code/mods`) show only a few events and fields, and there is no API reference.

## The solution / decision
- Probe first. A throwaway mod that dumps every event's keys to a file, run once with `claude -p --plugin-dir <probe> --model haiku`, answered most questions in about a minute for about $0.01.
- Event shapes I saw (2.1.296):
  - `tool.call`: the tool's inputs are flattened onto `e` (`e.skill`, `e.args`, `e.subagent_type`, `e.description`).
  - The result of `await next(e)` has `.result`. For Agent, that holds `agentId`, `resolvedModel` and `status: "async_launched"`.
  - `turn.complete` gives `usage` (input, output and cache tokens, plus model), `durationMs`, `answer`, and `agentId` for subagent turns. A subagent's own tool calls carry `agentId`, so filter on it.
  - `turn.start` gives `{text, turnId}`. `session.start` gives `{cwd, surface, isInteractive}`.
  - `$.session.usage()` returns `{startedAt, context:{tokens,window,percent}, rateLimits, cost:{usd}}`, where cost is for the whole session.
- Mods can't see shell hooks. A Stop-hook block still produced only one main `turn.complete`. The bridge is a JSON-lines file the shell hook appends to and the mod reads.
- **The real API reference is generated locally.** Each time it loads a mod, Claude Code writes TypeScript types to `<mod>/.claude-plugin/types/` plus a `tsconfig.json`. Read those before probing. Gitignore both, as the examples do.

## Why it wasn't obvious
- **There is no `process` global.** The module fails at load with `ReferenceError: process is not defined`. Read env or home paths through `$.process.run(["bash","-c", ...])`.
- **The validator parses the source.** `$` can't be read as a value (`Object.keys($)` is rejected). Only `$.noun.method(...)` at call sites and `on("event", hook)` are allowed.
- **The UI doesn't draw in `-p` mode.** To check it live, drive an interactive session with `expect`: `stty rows/columns`, accept folder trust with Down then Enter, and unset `CLAUDE_CODE_CHILD_SESSION`. Otherwise a nested session doesn't save its transcript, and transcript-based hooks see nothing.
- The terminal output is drawn with cursor moves (`\x1b[nG`) between words, so a regex like "Turn 1" fails. Match loosely (`Turn.{0,12}1`).
- The model names agents loosely ("Explore agent"), so match notes ignoring case and a trailing "agent".

## Pointers
- `mods/turn-card/` (README has the data sources), `audit-nudge/hook.sh` (`log_run`)
- Example mods: replay-theater (tool.call recording, panes), token-weather (`$.session.usage`), blast-radius (`$.process.run`)
- `claude plugin validate <dir>` lists hooks and `$` calls found
