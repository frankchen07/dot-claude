---
name: inventory-app-ocr-validation
description: OCR output is filtered silently, confidence scale not explicitly specified in prompt, JSON parse unguarded
metadata:
  type: project
---

**The Problem**: vision-ocr.ts:137-138 silently drops any inventory items the LLM detected that aren't in the known catalog. The prompt also doesn't explicitly state confidence must be 0-100.

**Why This Matters**: 
- User won't know OCR found an item they should add to the catalog
- If confidence isn't 0-100, the code in confirm/page.tsx that checks `confidence >= 70` will be wrong

**How to Apply**:
- Add explicit instruction to prompt: "confidence must be an integer from 0 to 100"
- Log or return warnings when OCR-detected items are filtered out so user knows to add them to the catalog
- Add try-catch around JSON.parse on line 135 to handle malformed LLM output gracefully
- Test with OCR that detects an item not in the catalog; verify user sees a warning

**Related**: inventory-app-sheets-atomicity (for the scan data that flows through this)
