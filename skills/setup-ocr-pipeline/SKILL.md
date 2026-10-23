---
name: setup-ocr-pipeline
description: >-
  Use when building or changing a pipeline that turns photos or scans of handwritten or printed sheets (count sheets, logs, forms) into structured data, or when auditing data already extracted or hand-transcribed from such photos. Covers the extractor choice, schema, vision-LLM extraction prompt, ground-truth diff harness, human confirm step, and guarding the calculations built on top. Triggers: set up OCR, extract data from photos, digitize handwritten sheets, photo to spreadsheet, vision extraction, OCR misreads, verify transcription against source photo, backfill from scans.
---

# OCR Pipeline Setup

## Overview

Getting text out of a photo is the easy part — any decent vision model does
it. The hard part is that extraction fails *quietly*: a confident misread, a
unit the sheet never had, a row that vanishes in a filter. Every stage below
exists to make a wrong value visible before a forecast, reorder list, or
trend claim gets computed on top of it.

Pipeline: **photo → extraction (schema + prompt) → ground-truth diff → human
confirm → stored records → derived metrics.** Don't ship extraction without
the diff harness from step 4 — it's the only way to know whether a prompt
change made things better or worse.

## 1. Pick the extractor

- Handwriting, a writer's personal shorthand, or a fixed form with known
  rows → a vision LLM with strict JSON-schema structured output. Classic OCR
  engines return text, not fields, and handwriting is where they're weakest.
- Use the strongest vision model available with high reasoning effort.
  Per-sheet cost is small next to the cost of a misread feeding a decision.
  Look up current model IDs (`claude-api` skill) rather than from memory.
- Handle every non-happy path with a thrown, specific error: missing API
  key, non-2xx response, refused/content-filtered image, unparseable JSON
  despite the strict schema. Never return an empty list on failure — empty
  looks like "nothing on the sheet."
- Store the raw model response next to the parsed result. When a misread
  surfaces weeks later, you'll want to see what the model actually said.
- The source is usually a phone photo. Crop to the sheet and fix rotation
  before sending — providers downscale oversized images, and small
  handwriting is the first thing lost. Check the provider's current image
  size limits.

## 2. Design the schema around what can go wrong

Each line item carries its value fields plus `confidence` (integer 0–100),
`ambiguous` (boolean), and `notes` (string or null). Make every field
required (nullable via `anyOf: [{type}, {type: "null"}]`) with
`additionalProperties: false`, so the model can't skip one.

- **Closed vocabulary.** Pass the known catalog (row IDs + display names) in
  the prompt and require exact IDs back. The model must never invent rows.
- **Filter unknown IDs after parsing, and say how many you dropped.** A
  silent filter is the same bug as the silent `continue` in step 5 — an
  item misread as an unknown name just disappears.
- **Blank ≠ unreadable.** A genuinely blank row comes back as null values
  with confidence 100. "Not counted this time" is a different fact from "I
  couldn't read it," and the schema has to keep them apart.
- **Confidence covers the whole value.** For values with qualifiers
  (quantity + unit, time + am/pm, a sign), confidence is about the complete
  structured value, not just whether the digits were legible.

## 3. Write the extraction prompt defensively

- Describe the sheet's layout and what each column means, including
  conditional columns (e.g. "sold-out time only if it sold out; unsold
  count only if it didn't").
- Give real examples of the writer's shorthand and have the model
  transcribe in that style ("1.75 boxes", "1 box and 6 sleeves"), with
  explicit rules for fractions → decimals and output formats (24-hour
  `HH:MM`).
- Uncertain read → still give the best reading, set `ambiguous: true`,
  confidence below 70, and say what the ambiguity is in `notes` ("could be
  43 or 48", "digit crossed out, reading second attempt").
- **Value present, required qualifier missing → `ambiguous: true`,
  regardless of digit confidence.** Don't rely on the model to fold this
  into its confidence number on its own. Real case: an inventory pipeline
  read bare "6" and "12" with no unit written anywhere on the sheet. The
  model gave them confidence 80–85 and `ambiguous: false` — it was sure of
  the digit — while its own notes said "no unit given." Downstream the
  values were unusable and nothing flagged them. A high-confidence read of
  an incomplete value is still an incomplete value.

## 4. Build the ground-truth diff before trusting the output

- Hand-transcribe a few real sheets carefully (use the audit method in step
  7) and store them as ground truth, ideally as seed records in the app's
  own database.
- Write a script that runs a real photo through the extractor and diffs
  field by field against the truth. Print every mismatch with the model's
  `confidence`/`ambiguous`/`notes`, then totals: matched, mismatched,
  extracted rows vs truth rows. List truth rows the extractor missed
  entirely by name, not just as a count difference.
- Read mismatches for calibration. A mismatch with `ambiguous: true` is the
  system working. A mismatch with high confidence and `ambiguous: false` is
  the dangerous kind — change the prompt to catch that pattern, then rerun.
- Rerun after every prompt change or model swap. This script is the
  regression test.

## 5. Confirm step, and nulls that stay visible

- Extraction produces a **draft**, not a record. A person confirms before
  it's saved, with rows where `ambiguous || confidence < 70` highlighted.
- Anything that can't be parsed or converted downstream must land in a
  visible bucket, never dropped. Real case: a restock list parsed free-text
  quantities against a unit-conversion table. For a unitless quantity the
  parser correctly returned null — but the list-building loop `continue`d
  past nulls, so the item vanished. One of the vanished items was already
  below its reorder threshold. Fix: a second "needs review" bucket next to
  the low-stock list. "Didn't crash" and "didn't disappear" are different
  bars — for every function that can return null, check what its caller
  does with it.

## 6. Guard the calculations built on top

- **Missing reference → null, not a plausible default.** When a derived
  value depends on a prior row, baseline, or first-in-sequence record and
  that record is missing, return null/unknown. A fabricated-but-plausible
  number is harder to catch than an honest "—".
- **"First" means first in the full domain, not first among the rows you
  happen to have.** Real case: a bakery's top-up bake sell-out time is
  measured from the morning bake's sell-out. A top-up row with no morning
  row that day is not "the first bake" just because it's the only row
  present — treating it that way invents a start time that never happened.
- **A known data quirk breaks invariants everywhere, not just where you
  first caught it.** Real case: unsold can exceed baked when leftovers get
  logged against a 0-baked row. The demand estimate already clamped
  `max(0, baked - unsold)`; a later chart recomputed `baked - unsold` on its
  own, skipped the clamp, and drew a marker outside its own bar. Before
  shipping a new calculation on two raw fields, grep for every other place
  that combines the same fields and copy their guard.

## 7. Auditing extracted data by hand

Use this to build ground truth (step 4), to check a backfill, or when a
number downstream looks wrong. "Already transcribed" is a hypothesis to
verify against the source image, not a fact.

1. **Crop and zoom.** Don't eyeball the full photo. Crop tight on the
   ambiguous region and zoom — `magick` (ImageMagick CLI; the old `convert`
   binary is deprecated) does this from the command line.
2. **Cross-reference.** Find clearly legible instances of the *same
   handwriting* elsewhere on the *same sheet*. The same person's "7" or
   am/pm mark repeats — an ambiguous instance is usually settled by an
   unambiguous one a few rows away, not by staring harder.
3. **Plausibility-check.** Check every proposed correction against the
   field's normal range across the whole dataset. A correction that lands
   outside it is guilty until proven innocent.
4. **Classify.** Tag each finding with a category below. A classified list
   tells you whether the pipeline has a systemic problem worth fixing in
   the prompt or schema; a raw diff list doesn't.

| Category | Description |
|---|---|
| Misread digit shape | A digit's shape was genuinely misread (e.g. 3 vs 8) |
| Row misattribution | Value was correct but written into/read from the wrong row |
| Fabricated value | A value in the record that isn't on the source at all |
| Column swap | Two columns' values were transposed |
| Genuinely ambiguous handwriting | Can't be resolved even with cross-referencing — flag it, don't force a guess |
| Context-blind reinterpretation | A literal, isolated reading that ignores corroborating context and produces a confidently wrong outlier |
| Underspecified extraction | Value read correctly, but a required qualifier (unit, category, sign) is missing from the source and had to be guessed |

**The false-positive failure mode.** A batch audit subagent once read an
ambiguous am/pm mark as "pm," producing a 10:30pm sold-out time. It didn't
check the identical mark on the two rows directly above (both "am"), and
didn't notice no sold-out time anywhere in the dataset went past ~2pm. The
"correction" was caught and reverted. **A correction that produces a domain
outlier is more likely a bad read than a real anomaly — verify it harder,
not less.**

**Batching large audits:**

- Run batches **sequentially** when several agents would write the same
  file — parallel writes to one seed-data file race and silently drop edits.
- Give fresh (non-fork) subagents a fully self-contained prompt with the
  method, taxonomy, and plausibility rule inline.
- Only fork when the parent session is small — forks inherit the whole
  parent context and a bloated one fails with "prompt too long."

## Rationalizations — stop and re-check

| Thought | Reality |
|---|---|
| "The model's confidence is high, so it's right" | Confidence covers the digit, not the missing unit or the wrong row. Check `notes`, and check the ground-truth diff for high-confidence misses. |
| "We'll add the ground-truth script later" | Without it, every prompt tweak is a guess. It's ~100 lines; write it before the second prompt change. |
| "Filtering out unknown rows is just cleanup" | It's a silent drop. Count and surface what you filtered. |
| "Null is handled — it doesn't crash" | Check where the null goes. If it's dropped from a rendered list, it's lost. |
| "The handwriting is ambiguous either way, I'll pick the likelier one" | Cross-reference the same sheet and check the plausibility range first. |
| "The subagent found an error, so there's an error" | A subagent's correction is a claim. Apply the same plausibility gate as to your own read. |
| "This is the first row I have, so it's the starting point" | First among rows present ≠ first in the domain. |

## Red flags

- Extraction returns an empty list on an API error instead of throwing
- Schema has no `ambiguous`/`notes` fields, or blank and unreadable rows look the same
- Unknown-ID filter with no count or warning
- No ground-truth diff script, or one that only prints a match percentage
- Extracted values saved without a human confirm step
- A list builder that `continue`s past null values
- A new `a - b` calculation on raw fields without grepping for existing guards on the same pair
- Accepting a "correction" that's an outlier against every other value of that field
- Parallel audit batches writing one shared data file
