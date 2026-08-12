---
name: chat-agent_message_formatting
description: Message excerpt parsing ambiguity in memory flush prompt
metadata:
  type: reference
---

**File:** `src/agent.py`, line 96

When `_maybe_compact()` builds the excerpt for memory flush, it uses simple newline-joined format:
```python
excerpt = "\n".join(f"{m['role']}: {m['content']}" for m in new_overflow)
```

**Edge case:** If a message contains the text "user: " or "assistant: ", the LLM may misparsе where one message ends and another begins. Example:

```
user: I asked the assistant: please help me understand this
assistant: Sure! User: let me break it down for you
```

The LLM parsing becomes ambiguous.

**Severity:** Minor. LLMs are generally robust enough to infer message boundaries from context, and the `MEMORY_FLUSH_PROMPT` asks for durable facts (not fine-grained message parsing). Not currently tested.

**How to apply:** If future observability shows LLM-extracted summaries are conflating unrelated messages, consider a more robust format (JSON lines, explicit message delimiters, etc.).
