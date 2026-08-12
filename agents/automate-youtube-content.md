---
name: automate-youtube-content
description: Template for a recurring video publishing workflow — processing, renaming, compressing, and uploading footage to YouTube. Customize the fixed paths, channel, and naming scheme below to your own setup, then trigger on your own folder names / keywords (e.g. "process my videos", "batch the footage", "prep for upload", "clean the drop folder").
---

# Video Publishing Skill (template)

Processes, compresses, renames, and publishes footage to YouTube Studio under `<YOUR_CHANNEL_HANDLE>` (Google account: `<YOUR_ACCOUNT_EMAIL>`).

Manual mode only — no automatic cron/heartbeat.

---

## Fixed Paths (customize)

- Drop/input: `<path to your raw-footage drop folder>`
- YouTube-ready (no audio): `<drop folder>/ytready`
- Archive (with audio): `<drop folder>/sstready`

---

## Canonical Naming Format

`YYYYMMDD-[dayofweek][morning|afternoon|night]-[LOCATION_CODE]-rolling-footage-viewN.mov`

**Time buckets** (local start time):
- `morning`: 04:00–11:59
- `afternoon`: 12:00–17:59
- `night`: 18:00–23:59

**Location mapping** (customize to your own recording locations):
- `<Location A>` → `<code-a>`
- `<Location B>` → `<code-b>`
- Unknown/ambiguous → `<default-code>`

**Examples:**
- `20260318-wednesdaynight-<code-a>-rolling-footage-view2.mov`
- `20260304-wednesdaymorning-<code-b>-rolling-footage-view1.mov`

---

## Workflow Steps

1. Scan drop folder; group videos by session/date
2. Extract metadata (creation time, location if available)
3. Propose rename plan — **wait for approval before applying**
4. Rename originals
5. Compress using required ffmpeg command (see below)
6. Validate output (duration, playback, size sanity)
7. Move originals to Trash (never permanent delete)
8. From each compressed canonical, create two copies:
   - No-audio + `-ytready` suffix → `ytready/`
   - With-audio archive copy → `sstready/`
9. Ask user to identify any special/teaching footage
10. Apply teaching copy rule (see below), if applicable
11. After confirmed upload, move `-ytready` artifact to `.trash`
12. Run final checklist before clearing working folder

---

## Teaching Copy Rule (customize or remove if not applicable)

Create a teaching copy **only if**:
- Location matches your regular teaching location code
- Captured during your regular teaching schedule (customize days/time)

Teaching copy naming: `YYYYMMDD-teaching-class-<your-initials>.mov`
Place in same archive destination (`sstready/`) and prep for YouTube upload.

---

## Compression Command

```bash
ffmpeg -loglevel error -hide_banner -nostats -i "$input_file" \
  -c:v libx264 -profile:v high -level 4.1 -preset veryfast -crf 23 \
  -vf "scale=1280:720,fps=30" \
  -b:v 8083k \
  -c:a aac -b:a 191k -ar 44100 \
  -movflags +faststart \
  "$compressed_file"
```

---

## Output Format

### Batch Summary
- Input folder:
- Files detected:
- Sessions inferred:

### Rename Plan
- `old name` → `new canonical name`
- Confidence notes (time/location assumptions)

### Processing Results
- Compressed: X/Y
- Originals moved to Trash: X/Y
- Uploaded ytready moved to Trash: X/Y
- YT-ready no-audio copies created: X
- Archive with-audio copies: X

### Teaching Footage Checkpoint
- Need user input: yes/no
- If yes, request exact files or date/time references

### Final Checklist
- YouTube uploads complete: yes/no
- External drive archive complete: yes/no
- Safe to clean working folder: yes/no
- Outstanding issues:

---

## Constraints

- Safe, reversible actions only
- Never permanently delete source files — use Trash
- Do not wipe files until upload AND backup are both confirmed
- Ask before any destructive or irreversible action
- If metadata is missing or conflicting, pause and ask — never guess
- Naming must be deterministic and idempotent (no duplicate suffix stacking)
- One checkpoint question at a time
