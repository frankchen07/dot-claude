---
name: inventory-app-sheets-atomicity
description: Google Sheets persistence lacks transaction support; partial failures in confirmScan corrupt state
metadata:
  type: project
---

**The Problem**: confirmScan (inventory.ts:145-209) does 3+ sequential Sheets API writes in a loop with no atomicity.

**Why This Matters**: If the function crashes after updating 5 scan line items but before updating inventory counts, the state is corrupted—the inventory is partially updated and there's no rollback.

**How to Apply**: 
- All Sheets-backed functions that do multi-row writes need idempotence markers or explicit error handling with state rollback
- Consider adding a "last_confirmed_row" or checksum so re-runs don't duplicate/corrupt
- Test the code path: upload a scan, hit confirmScan, simulate a failure mid-loop (e.g., by deleting an inventory item mid-write), and verify recovery

**Related**: inventory-app-ocr-validation (LLM output validation for the scan data)
