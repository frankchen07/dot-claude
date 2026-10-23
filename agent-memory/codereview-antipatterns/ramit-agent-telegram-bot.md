---
name: ramit-agent-telegram-bot
description: ramit-agent (Telegram + LangGraph): intentional HTML-render/fallback and compaction-retry designs; known weak spots
metadata:
  type: project
---

Intentional designs (do not flag):
- src/bot.py `_to_telegram_html` converts only **bold**, `code`, # headings; single-asterisk italics deliberately skipped (clash with `* ` bullets). Malformed/nested markup is meant to fall back to plain text via `except BadRequest`.
- Telegram's 4096 limit is counted after entity parsing, so HTML escaping/tags don't break `_split_message` chunking.
- src/agent.py `_respond` swallows compaction failure and leaves `summarized_through` alone so it retries next turn (reviewed 2026-10-18).
- Retrieval is pre-injected into the system prompt (src/tools.py "## Relevant Source Chunks"); there is no tool. SOUL.md must not reference tool calls.

Weak spots worth re-checking:
- Compaction retry: during a long memory-model outage `new_overflow` / excerpt grows without limit, so a context-length failure can feed itself.
- Retrieval queries only the latest user message; vague follow-ups get weak grounding (the old "query twice" instruction was dropped because the tool never existed).
- PII in logs: handle_error now logs ids only; watch new logger calls that interpolate message text or Update objects.
