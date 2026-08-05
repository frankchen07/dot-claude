---
name: audit-ocr-data
description: Use when verifying hand-transcribed or OCR-extracted data against source photos/scans — auditing digitized records, checking manual data entry, cross-referencing scanned handwriting against a database or spreadsheet. Triggers: audit transcription, verify against source photo, ground truth check, handwriting OCR audit, backfill verification.
---

# Manual-Transcription Audit

## Overview

Transcribed or OCR'd data is only as good as its ground truth. "Already
transcribed" is a hypothesis to verify against the source image, not a fact
to build on. The point of this audit is to catch real transcription bugs
before they poison downstream calculations (forecasts, trend claims,
anything computed on top of the data) — not to produce an OCR accuracy
score.

## Method

1. **Crop and zoom.** Don't eyeball the full-resolution source photo/scan.
   Crop tight on the ambiguous region and zoom in — `magick` (ImageMagick
   CLI; the `convert` binary it replaces is deprecated) handles this from
   the command line.
2. **Cross-reference.** Find other clearly-legible instances of the *same
   handwriting* elsewhere on the *same sheet*. The same person's "7" or
   their am/pm mark repeats — an ambiguous instance is usually resolved by
   an unambiguous one a few rows away, not by staring harder at the one
   you're stuck on.
3. **Plausibility-check.** Before accepting any proposed correction, check
   it against the domain-wide range of values you'd expect (e.g. sold-out
   times cluster ~9am–2pm across every sheet in a bakery dataset — a
   reading of 10:30pm is a signal to dig deeper, not a fact to accept as
   soon as it's "read"). An outlier correction is guilty until proven
   innocent.
4. **Classify.** Tag every finding with a category from the taxonomy below.
   A list of raw diffs tells you what changed; a classified list tells you
   whether the transcription process has a systemic problem worth fixing
   upstream.

## Error taxonomy

| Category | Description |
|---|---|
| Misread digit shape | A digit's shape was genuinely misread (e.g. 3 vs 8) |
| Row misattribution | Value was correct but written into/read from the wrong row |
| Fabricated/invented value | A value present in the record that isn't actually on the source at all |
| Column swap | Two columns' values were transposed |
| Genuinely ambiguous handwriting | Can't be resolved even with cross-referencing — flag and note, don't force a guess |
| Context-blind reinterpretation | A literal, isolated reading that ignores corroborating context and produces a confidently-wrong outlier |

## Designing derived metrics defensively

Not every bug here is a bad transcription — some are in the code that turns
correct records into a derived metric. When a derived value depends on a
reference/baseline data point (a prior timestamp, a prior row, an assumed
first-in-sequence), don't silently substitute a plausible-looking default
when that reference is missing. Return null/unknown instead of guessing —
a fabricated-but-plausible number is harder to catch downstream than an
honest "—".

Concretely: check whether "first in this result set" really means first in
the full domain, or just first among the rows that happen to be present for
this particular slice of the data — those aren't the same thing once data
can be sparse. (Example: a bakery's Topup bake time-to-sell-out should be
measured from its AM bake's sell-out time. A row present with no AM row
that day is not "the first bake of the day" just because it's the only row
you can see — treating it as such invents a start time that never
happened. Compute "first" against the *global* set of possibilities, not
the *local* set of what's present.)

## The false-positive failure mode

This is the failure mode most likely to recur, so it gets named explicitly.

A batch audit subagent once read an ambiguous am/pm mark on one row as
"pm," producing a 10:30pm sold-out time for a bakery product. It didn't
cross-check the identical mark on the two rows immediately above it on the
same sheet — both correctly read as "am" — and it didn't sanity-check the
result against the fact that no sold-out time anywhere in the entire
dataset went past ~2pm. The "correction" was caught, reverted, and traced
back to a literal, context-blind read of one isolated character.

**Rule: a "correction" that produces a domain outlier is more likely to be
a bad reading than a real anomaly — verify it harder than a correction that
lands in-range, not less.** Treat plausibility as a gate on acceptance, not
a post-hoc sanity note.

## Batching guidance for large audits

For backfills or audits spanning many sheets/records:

- Split into **sequential**, not parallel, batches when multiple agents
  would write to the same file — parallel writes to a shared file (e.g. a
  single seed-data JSON) race and silently drop each other's edits.
- Give fresh (non-fork) subagents a **fully self-contained prompt** that
  includes the method, the taxonomy, and the plausibility-check rule
  inline. Don't rely on inherited context they won't have.
- Fork subagents inherit the *entire* parent session. Only fork when the
  parent session is small enough that this won't blow the context budget —
  a bloated parent session (e.g. one with verbatim skill docs already
  loaded) risks "prompt too long" failures on fork.

## Rationalizations — stop and re-check

| Thought | Reality |
|---|---|
| "The handwriting is ambiguous either way, I'll just pick the more legible-looking option" | Check the plausibility range first. An ambiguous read that lands outside the domain's normal range is a red flag, not a coin flip to settle by squinting. |
| "It's just one row, not worth cross-referencing" | The cross-reference check costs one image crop. A silent bad value compounds into every downstream calculation built on this data. |
| "The subagent said it found an error, so it found an error" | A subagent's "correction" is a claim, not a fact — apply the same plausibility gate to a subagent's finding that you would to your own first read. |
| "This is the first row I have data for, so it must be the starting point" | Check whether it's first in the full domain or just first among the rows present in this particular slice — a later-stage record can exist with no earlier-stage record, and treating it as "first" invents a start point that never happened. |

## Red Flags

- About to accept a reading that's an outlier relative to every other
  value of the same field in the dataset
- Resolving ambiguous handwriting by "picking the one that seems more
  likely" without looking at other instances on the same sheet
- Running audit batches in parallel against a single shared data file
- A fresh subagent's audit prompt doesn't itself contain the taxonomy and
  plausibility rule — it's relying on context it doesn't have
