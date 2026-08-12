---
name: chat-agent_test_gap_second_compaction
description: Missing test coverage for sequential compactions
metadata:
  type: reference
---

**File:** `tests/test_agent.py`

The test suite covers the first compaction trigger correctly (`test_maybe_compact_triggers_at_batch_threshold`) but lacks a test for the **second and subsequent compactions** to verify that `summarized_through` offset tracking works correctly across multiple compaction events.

**Scenario not tested:**
1. First compaction: 30 overflow messages → `summarized_through = 30`
2. Add 10 more messages (bringing overflow to 40 total)
3. Second compaction: should process only messages 30-39 (the 10 new ones), not re-process messages 0-29

**Why it matters:** The `summarized_through` field is critical to correctness—it prevents re-summarizing the same messages. The math checks out, but sequential behavior under state persistence is not explicitly verified.

**How to fix:** Add `test_maybe_compact_second_compaction` that:
1. Sets up initial state with 30 overflow messages and `summarized_through=30`
2. Adds 10 more messages (overflow now 40)
3. Calls `_maybe_compact()` again
4. Asserts it only processes the 10 new messages
5. Asserts `summarized_through` is updated to 40
