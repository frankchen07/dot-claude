# dot-claude

Personal Claude Code configuration — global instructions, custom agents, hooks, and settings.

---

## Structure

```
.claude/
├── CLAUDE.md                        # Global system prompt
├── settings.json                    # Model, env vars, hooks wiring
├── .claudeignore                    # Files Claude won't read
├── agents/
│   └── quality-control-enforcer.md  # Code review subagent
├── plans/                           # Plan mode artifacts
├── plugins/
│   ├── blocklist.json               # Blocked plugins
│   ├── installed_plugins.json       # Installed plugin registry
│   └── known_marketplaces.json      # Marketplace sources
└── read-once/
    ├── hook.sh                      # PreToolUse hook (read dedup)
    └── compact.sh                   # PostCompact hook (cache reset)
```

---

## Files

### `CLAUDE.md`
The global system prompt injected into every Claude Code session. Defines personality (chaotic good, direct, dry humor), communication style (short, no preamble, no sycophancy), areas of expertise, and situational guidelines (brainstorming, writing, coding). This is the single source of truth for how Claude behaves across all projects.

### `settings.json`
Runtime configuration wired at the user level.

| Key | Value | Purpose |
|-----|-------|---------|
| `model` | `claude-sonnet-4-6` | Default model |
| `MAX_THINKING_TOKENS` | `10000` | Cap on extended thinking budget |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | `50` | Compact context at 50% full (vs default) |
| `CLAUDE_CODE_SUBAGENT_MODEL` | `haiku` | Subagents use Haiku to save cost |
| `enabledPlugins` | `vercel` | Vercel plugin active |
| `hooks.PreToolUse` | `hook.sh` on Read | Runs read-once dedup before every file read |
| `hooks.PostCompact` | `compact.sh` | Clears read cache after context compaction |

### `.claudeignore`
Tells Claude not to read certain file types when indexing or exploring a project — secrets, build artifacts, binaries, large data files, logs, and IDE config. Reduces noise and prevents accidental secret exposure.

---

## Agents

### `agents/quality-control-enforcer.md`
A narrow code review subagent. Triggered automatically after feature implementations, bug fixes, or refactors to catch shortcuts, simulated success, and incomplete work.

**Checklist it enforces:**
- Workarounds, monkey patches, band-aids
- Mocked/simulated data outside test files
- Swallowed errors
- Hard-coded logic that should be dynamic or LLM-driven
- Partial implementations (happy path only)
- APIs claimed but not actually called
- TODOs presented as complete
- Unhandled async flows

**Role:** Review only — it reports gaps and required fixes, never rewrites code.

---

## Hooks (`read-once/`)

A token-saving system built on two Claude Code lifecycle hooks.

### `hook.sh` — PreToolUse on Read
Tracks every file read within a session. When Claude tries to re-read a file:

- **Unchanged file, within TTL (20 min):** blocks the re-read, tells Claude the content is already in context. Saves ~2000+ tokens per prevented re-read.
- **Changed file, diff mode on:** shows only the diff instead of the full file. Saves 80–95% of tokens on iterative edits.
- **Expired TTL:** allows the re-read (context may have compacted and lost the content).

Default mode is `warn` (allows read with advisory) rather than `deny` (hard block), to avoid deadlocking the Edit tool.

Config via env vars: `READ_ONCE_MODE`, `READ_ONCE_TTL`, `READ_ONCE_DIFF`, `READ_ONCE_DIFF_MAX`, `READ_ONCE_DISABLED`.

### `compact.sh` — PostCompact
When Claude compacts the conversation context, it loses file contents. This hook immediately clears the read-once session cache so those files can be re-read on the next request — no waiting for the 20-minute TTL to expire.

---

## Plans (`plans/`)

Artifacts from Claude Code's `/plan` mode. Each file is a named implementation plan from a past session — context, proposed changes, decisions made, and open questions. Used as a shared scratchpad between plan and implementation phases. Not intended as long-term documentation; kept here for reference.

---

## Plugins

| File | Purpose |
|------|---------|
| `installed_plugins.json` | Registry of installed plugins with version and install path |
| `blocklist.json` | Plugins explicitly blocked from running |
| `known_marketplaces.json` | Registered marketplace sources Claude Code checks for plugins |

Currently installed: **Vercel** plugin (`v0.42.1`) for deployment, preview, and edge config tooling.

---

## What's Not Here

Runtime and ephemeral data is gitignored:

- `projects/` — conversation logs (`.jsonl`), potentially sensitive
- `session-env/`, `sessions/` — per-session state
- `backups/`, `cache/`, `telemetry/`, `statsig/` — internal Claude Code runtime
- `plugins/marketplaces/` — auto-synced from remote, not manual config
- `settings.local.json` — machine-specific permissions overrides
