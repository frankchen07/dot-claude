---
name: posnos-swr-editable-state
description: posnos components poll live data via useSWR; an editable input seeded from a poll-derived prop via useState never resyncs, silently diverging across devices
metadata:
  type: project
---

**The Pattern**: Most posnos display components (`LiveOrders`, `SummaryView`) are read-only lists driven straight off `useSWR(..., { refreshInterval })` — no local state to go stale, so polling "just works" for keeping multiple concurrent devices in sync (this app supports multiple stations joining one event).

**The Anti-Pattern Seen**: `MaterialRow` in `src/components/summary-view.tsx` (added 2026-09 for milk material tracking) is the first editable-input component layered on top of SWR-polled data. It seeds local state with `useState(material.manualContainers?.toString() ?? "")`. Because the initial value is only read on mount and the component's `key` never changes, the input never resyncs when the poll (or another device's save) brings in a new server value — two stations editing the same field will silently diverge, with the loser's screen frozen on stale/incorrect data and no conflict indicator.

Compounding bug found alongside it: `save()` is fired `onBlur` with no dirty-check, and `Number("")` evaluates to `0`, which passes the route's `isFinite && >= 0` validation — so simply tabbing through an untouched empty field silently persists "0" as a confirmed manual count.

**Why This Matters**: posnos's whole value prop for live sections is "multiple devices see the same truth." Any new editable control bolted onto a polled read model breaks that invariant unless it explicitly reconciles local edits against server truth (e.g. only diverge from props while focused/dirty, resync on blur-cancel or on receiving a materially different prop).

**How to Apply**: When reviewing any new posnos component that adds an editable input over `useSWR`-polled data, check: (1) does local state resync when the underlying data changes from another source, and (2) does the save path distinguish "untouched/empty" from "confirmed value," especially where empty-string-to-number coercion (`Number("")` → `0`) can slip past validation.

**Related**: [[posnos-upsert-race]] (same feature, backend half of the concurrency story)
