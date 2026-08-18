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
| Underspecified extraction | The value itself was read correctly, but a required qualifier (unit, category, sign) is missing from the source and had to be guessed — confidence should reflect the *whole* structured value, not just digit legibility |

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

A known data quirk can also violate an invariant you'd otherwise assume
holds between two fields — and once you've defended against it in one
place, every other place that derives a value from the same two fields
needs the same guard, not just the first one that got caught. (Example:
this bakery's `unsoldQty` can exceed `bakedQty` when leftovers get logged
against a 0-baked topup row instead of the batch that actually produced
them — a real transcription/attribution pattern in the source sheets, not
a one-off typo. `estimateDemand()` in `demand-calc.ts` already clamps this
with `Math.max(0, bakedQty - unsoldQty)`. When a later feature — a
"recommendation composition" visual on the comparison page — recomputed
`actualBakedQty - actualUnsoldQty` independently for a marker position, it
skipped the clamp, produced a negative value, and rendered the marker
outside its own bar. The fix wasn't "handle negative numbers," it was
"reapply the invariant that was already established defensively
elsewhere." Before shipping a new derived calculation, grep for whether the
same raw fields are combined anywhere else in the codebase — if so, check
whether that existing code carries a guard your new code is silently
missing.)

**Returning null is only half the fix — that null still has to be surfaced somewhere a human will see it.** "Didn't crash" and "didn't disappear" are different bars. A filter/list-building function that silently `continue`s past every unparseable value produces a result that looks complete but isn't — the omission is indistinguishable from "everything's fine." (Example: `inventory-tracker`'s restock list flagged items below a reorder threshold, computed from a free-text quantity parsed against a unit-conversion table. When OCR read a bare number with no unit (see "Designing extraction prompts defensively" below), the parser correctly returned null — but the list-building code's response to null was `continue`, so the item just vanished from the restock list instead of appearing anywhere. One of the vanished items was already below threshold. The fix was a second bucket — `needsReview`, alongside the low-stock list — so a null lands somewhere visible instead of nowhere. Any time a derived-value function returns null/unknown for "couldn't compute," check what its caller does with that null: if the caller's response is to drop the row from a rendered list, that's the same bug wearing a defensive-looking wrapper.)

## Designing extraction prompts defensively

When the "OCR" step is an LLM extracting structured fields (not just digits) — e.g. a quantity *and* a unit — a bare digit-recognition confidence score doesn't capture every failure mode. A model can be fully confident it read "6" correctly while the unit next to it was never written at all; that's not a low-confidence digit read, it's a missing field the model quietly filled in from context (or didn't fill in at all).

**Rule: instruct the extraction prompt to treat "value present, required qualifier missing or inferred" as its own explicit trigger for the ambiguous flag — don't rely on the model to fold that into its confidence number on its own.** A high-confidence read of an incomplete value is still an incomplete value.

Concretely: an inventory OCR pipeline (`inventory-tracker`) extracted quantities like `"6"` and `"12"` with no unit written on the source sheet at all. The model gave these confidence 80-85 (it was genuinely sure the digit was "6") and left `ambiguous: false`, even though its own notes admitted "no unit given." Downstream, these values were unusable (nothing to convert them by) but nothing flagged them for human review. Fix: the system prompt now explicitly says to set `ambiguous: true` whenever a value is missing a required qualifier, independent of digit confidence.

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

In the demand-predictor repo specifically: `scripts/test-ocr.ts` runs a real
photo through OCR and diffs the result against a seeded ground-truth
submission (matches/mismatches/missing rows printed per line item). Run it
before auditing by hand — it's a cheap first pass that surfaces the same
kind of misreads this skill looks for, without spending manual review time
on rows the script already confirms match.

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
- Writing a new subtraction/derived calculation between two raw fields
  (e.g. `baked - unsold`) without checking whether that same pair is
  combined elsewhere in the codebase and, if so, whether that code clamps
  or guards against a known invariant violation
