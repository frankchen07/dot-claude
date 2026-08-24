# dot-claude

Personal Claude Code configuration — global instructions, skills, agents, and hooks. Shared for reference: the skills and agents here reflect one person's workflow, house style, and recurring failure modes. Adapt what's useful rather than copying wholesale — several skills (`comms-dealmaking`, `automate-youtube-content`) are templates with the original personal specifics stripped out on purpose.

---

## Structure

```
.claude/
├── CLAUDE.md                   # Global system prompt
├── settings.json               # Model, env vars, hooks wiring
├── .claudeignore                # Files Claude won't read
├── .gitignore                   # What stays out of this repo
├── skills/                      # 14 skills — see below
├── agents/                      # 9 agents — see below
├── agent-memory/                 # Persistent per-agent memory files
├── plans/                       # Plan-mode artifacts (gitignored — personal scratch)
├── plugins/
│   ├── blocklist.json          # Blocked plugins
│   ├── installed_plugins.json  # Installed plugin registry
│   └── known_marketplaces.json # Marketplace sources
├── read-once/                  # Token-saving read-dedup hooks
└── audit-nudge/                # Stop hook enforcing audit-session-summary
```

---

## Core files

### `CLAUDE.md`
The global system prompt injected into every session — personality, communication style, areas of expertise, safety rules (never commit secrets, confirm before destructive/irreversible actions), and a task-lifecycle map of which skills to reach for at which point in a task.

### `settings.json`
Runtime configuration wired at the user level.

| Key | Value | Purpose |
|-----|-------|---------|
| `model` | `sonnet` | Default model |
| `MAX_THINKING_TOKENS` | `10000` | Cap on extended thinking budget |
| `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` | `50` | Compact context at 50% full (vs default) |
| `CLAUDE_CODE_SUBAGENT_MODEL` | `haiku` | Subagents use Haiku to save cost |
| `enabledPlugins` | `vercel` | Vercel plugin active |
| `hooks.PreToolUse` | `read-once/hook.sh` on Read | Read-dedup, saves tokens on re-reads |
| `hooks.PostCompact` | `read-once/compact.sh` | Clears read cache after context compaction |
| `hooks.Stop` | `audit-nudge/hook.sh` | Enforces `audit-session-summary` before a turn ends |

### `.claudeignore`
Tells Claude not to read certain file types when indexing or exploring a project — secrets, build artifacts, binaries, large data files, logs, and IDE config.

### `.gitignore`
Keeps runtime/ephemeral and personal-scratch content out of this repo — see [What's Not Here](#whats-not-here) below.

---

## Skills (`skills/`)

Grouped by what they govern. Each is a `SKILL.md` with a `description` frontmatter field the model matches against — Claude Code decides when to load one, it isn't a manual menu.

**Coding**
- **`coding-native-code`** — Keeps generated code in the voice of the file it's added to: match existing naming, error-handling idiom, and comment density instead of importing personal habits like defensive try/catch, doc comments, or narrating what was deliberately left out. Comments are for constraints the code can't show, not narration of the change.
- **`coding-scope-discipline`** — Guards against scope creep inside a requested change: implement exactly what was asked, at the right altitude, with adjacency ("same file," "same function") explicitly not counted as authorization. Real discoveries and adjacent improvements go in the report for the user to decide on, not into the diff.
- **`coding-git-history`** — Removes a secret, large binary, or otherwise-shouldn't-be-tracked file from git history using `git filter-repo`, not just a follow-up delete commit (which only stops future tracking). Covers blast-radius checks, backup-before-rewrite, re-adding the `origin` remote `filter-repo` strips, `--force-with-lease` over plain `--force`, and verifying against a fresh clone rather than trusting exit codes.
- **`coding-git-priv-pub`** — The audit-and-decide layer for making any repo safe to publish: finds secrets, PII, and business/personal-sensitive content — including content already sitting in git history, and content still reachable under a path a file was renamed away from — decides what to delete/anonymize/exclude, and hands off to `coding-git-history` for the actual purge. Ships a companion `pre-push-secret-scan.sh` git hook for standing protection against the next accidental secret commit.

**Communication & output**
- **`comms-outcome-first`** — Governs how replies are written: the first sentence answers the question actually asked, structure (headers/bullets) is earned by the content rather than applied by default, and thoroughness shows in the answer's quality rather than the report's length. Bans meta-preamble ("This is a judgment question...") and sycophantic openers.
- **`comms-dealmaking`** — A negotiation and deal-coaching template (job offers, equity, freelance rates, rent, contracts) built around named frameworks (Sethi, Voss, Ury, Dawson, Bourkoff), failure-mode interception, and ready-made scripts for offer receipt, pushback, and closing. Ships as a fill-in-the-blank template — the profile section is meant to be customized with the actual user's real specifics.
- **`output-do-the-work`** — A turn ends when the work is done or genuinely blocked on something only the user can provide — not because of an error, a "want me to?" impulse, or session length. Reversible, in-scope work gets done without a checkpoint; errors are the start of investigation, not a stopping point.
- **`output-prove-it`** — Distinguishes three rungs of a claim — written, runs, verified — and requires naming which one you're actually on before saying something is "fixed" or "done." Verification has to be an action taken this session (running the test, hitting the endpoint), not re-reading the code or inferring from a changed error message.

**Process**
- **`explore-effective-efficiency`** — Context-spending discipline for multi-step tasks: batch independent reads/searches into one parallel block, read targeted sections instead of whole files, delegate broad sweeps to a search subagent but keep direct lookups direct, and stop exploring once another pass wouldn't change the next action.
- **`audit-session-summary`** — Prints a short status readout of every Skill and Agent used in a turn — name, why it was reached for, and the outcome — right before ending a turn or entering plan-mode approval. Backed by the `audit-nudge` `Stop` hook rather than left to memory, since a purely prompt-based version reliably got skipped under context pressure or after compaction.

**Audit**
- **`audit-ocr-data`** — Verifies hand-transcribed or OCR-extracted data against source photos/scans before trusting it downstream. Covers cropping/zooming ambiguous regions, cross-referencing the same handwriting elsewhere on a sheet, and plausibility-checking corrections against the domain's normal value range rather than accepting the first "read." Includes an error taxonomy and guidance for batching large audits across fresh (non-forked) subagents.

**Setup / integrations**
- **`setup-railway`** — Comprehensive operating guide for Railway infrastructure: projects, services, environments, buckets, deployments, feature flags, domains, and agent/MCP tooling setup, including the account creation/sign-in flow (browser vs. device-code) and routing between the CLI, remote MCP, and GraphQL depending on the task.
- **`setup-shopify-headless`** — Debugging checklist and architecture guidance for headless Shopify Storefront API integrations: the token-type-confusion / password-protected-store / stale-API-version auth-failure checklist, the B2B+subscription pattern, running multiple headless channels off one store, and why client-side cart mutations need a client-exposed Storefront token.
- **`setup-vercel-integration`** — Flags a specific `vercel integration add <provider>` gotcha: it defaults to auto-provisioning a brand-new sandbox resource rather than connecting to a provider account the user already has, which is easy to misread as "successfully connected." Covers choosing between claiming the sandbox or connecting the real existing resource, plus cleanup if the wrong path was already taken.

---

## Agents (`agents/`)

Subagents invoked via the `Agent` tool — each runs with its own context window and (usually) a narrower tool set.

**Code review**
- **`codereview-antipatterns`** — Static reviewer for LLM-specific and recycled-failure anti-patterns after a feature, fix, or refactor: hardcoded decision trees that should be dynamic, unconfigured token limits, functionality deleted instead of fixed, and the same broken approach retried with cosmetic changes. Keeps a persistent per-codebase memory (`agent-memory/codereview-antipatterns/`) of recurring patterns and known-brittle areas.
- **`codereview-claudemd`** — Checks recent changes against the rules in a project's `CLAUDE.md` — file-creation policy, documentation restrictions, architecture/tech-stack requirements — and reports specific violations with the exact rule quoted, a severity rating, and a concrete fix.
- **`codereview-overengineering`** — Reviews recent code for unnecessary complexity relative to the actual problem: enterprise patterns in small projects, intrusive automation/hooks, boilerplate infra nobody asked for, and requirements met with a heavier solution than the task needed.

**Verification**
- **`verify-e2e-complete`** — Independently checks whether a claimed-done feature is actually done, both structurally (no stubs, swallowed errors, or missing pieces) and in reality (it actually runs and works when executed). Matches its output to the size of the ask and only pulls in sibling agents when doing so would materially change the answer.
- **`verify-spec-match`** — Independently verifies that an implementation matches its written specification by examining the actual codebase rather than trusting a report of what was built, producing a gap analysis (missing / extra / incomplete / incorrect) with file:line evidence and severity ratings.

**Debugging & testing**
- **`debug-root-cause`** — Deep, systematic root-cause debugging for production issues, intermittent failures, and environment-specific bugs: reproduce, trace the full call stack, form and test a hypothesis, then fix the root cause with verification in the exact failing scenario before declaring it solved.
- **`test-ui`** — Thorough UI testing across web and mobile, auto-selecting Puppeteer, Playwright, or Mobile MCP based on platform. Specifically guards against the "no visual change" trap: content-only/data-swap changes are the highest-risk case for a silent rendering regression, so it screenshots and checks every mapped/looked-up value individually rather than trusting a passing build.

**Personal automation (templates)**
- **`automate-youtube-content`** — Template for a recurring video-processing/publishing pipeline: scan a drop folder, propose a canonical rename plan, compress via a fixed `ffmpeg` command, split into platform-ready and archive copies, and apply a location/schedule-based rule for a secondary "teaching" copy. Shipped with placeholder paths/channel/schedule in place of the original personal workflow it was built from.
- **`summarize-content-persona`** — Distills a person's knowledge, philosophy, or expertise from a collection of source material into a compressed advisor-persona file (frameworks, vocabulary, blind spots, contradictions, signature advice patterns).
- **`summarize-content-skill`** — Converts a body of source material (several books, a course, articles, notes) into a draft Claude Skill directory (`SKILL.md` + optional `references/`/`scripts/`), rewriting the source's frameworks and principles as imperative procedure rather than a knowledge summary. Hands off to the official `skill-creator` plugin (or manual dogfooding) for testing and description tuning.

---

## Hooks

### `read-once/` — token-saving read dedup
- **`hook.sh`** (`PreToolUse` on `Read`) — tracks every file read in a session; a same-content re-read within a TTL (default 20 min) is blocked with an advisory (or hard-denied, configurable) instead of re-sent. A changed file can show just the diff instead of the full content. Config via `READ_ONCE_MODE`, `READ_ONCE_TTL`, `READ_ONCE_DIFF`, `READ_ONCE_DISABLED`.
- **`compact.sh`** (`PostCompact`) — clears the read-once cache immediately after context compaction, since compaction drops file contents from context and the TTL alone would leave a stale window.

### `audit-nudge/` — enforces `audit-session-summary`
- **`hook.sh`** (`Stop`) — a purely prompt-based "summarize what skills/agents you used" instruction reliably got skipped under context pressure or after compaction. This hook checks the session transcript for a Skill/Agent invocation more recent than the last `audit-session-summary` call and blocks the turn from ending until it runs — capped at two consecutive nudges to avoid a loop, and it respects the same "no audit summary" / "audit summary on" suppression phrases the skill itself recognizes.

### `coding-git-priv-pub/pre-push-secret-scan.sh` — real git hook, not a Claude Code hook
Not wired through `settings.json` — this is a standard `git` `pre-push` hook, installed per-repo (`cp` into `.git/hooks/pre-push`, `chmod +x`) so it fires on any push regardless of whether it goes through Claude Code, a terminal, or an IDE. Scans outgoing commits for secret-shaped strings (API keys, private key headers, embedded connection-string credentials) and blocks the push with the specific match if found. Expect occasional false positives on legitimate env-var-based connection strings (`postgres://$USER:$PASSWORD@host`) — read the actual match before overriding with `--no-verify`.

---

## `agent-memory/`

Persistent, per-agent memory that survives across sessions — currently used by `codereview-antipatterns` to record recurring anti-patterns, known-brittle areas, and intentional-but-anti-pattern-looking design decisions for a given codebase, so repeat reviews don't re-flag the same false positive. `MEMORY.md` in each subdirectory is a one-line-per-file index; individual memory files use frontmatter (`name`, `description`, `type`).

## `plans/`

Plan-mode artifacts — auto-named files from past planning sessions. **Gitignored, not published.** Auto-generated filenames turned out to be a poor proxy for content sensitivity: this directory accumulates real working context over time (business specifics, personal infrastructure detail) regardless of how generic it looks at a glance, so it's treated as private scratch by default rather than audited file-by-file.

## `plugins/`

| File | Purpose |
|------|---------|
| `installed_plugins.json` | Registry of installed plugins with version and install path |
| `blocklist.json` | Plugins explicitly blocked from running |
| `known_marketplaces.json` | Registered marketplace sources Claude Code checks for plugins |

Currently installed: **Vercel** plugin, for deployment, preview, and edge-config tooling.

---

## What's Not Here

Runtime, ephemeral, and personal-scratch data is gitignored:

- `projects/` — session transcripts (`.jsonl`) and auto-memory — full raw conversation history, the highest-density sensitive-content category in this repo
- `daemon/`, `jobs/` — Claude Code's local background-daemon and job-queue runtime state (PIDs, session IDs, control tokens)
- `plans/` — personal planning scratch (see above)
- `session-env/`, `sessions/`, `shell-snapshots/`, `tasks/`, `todos/` — per-session runtime state
- `backups/`, `cache/`, `telemetry/`, `statsig/` — internal Claude Code runtime
- `read-once/session-*.jsonl`, `read-once/stats.jsonl`, `audit-nudge/state/` — this repo's own hooks' runtime caches (the scripts themselves are tracked)
- `plugins/marketplaces/` — auto-synced from remote, not manual config
- `settings.local.json`, `history.jsonl` — machine-specific / conversation-log data

If you're forking this: run `coding-git-priv-pub` before making your own version public — several rounds of exactly this audit were needed to catch content that didn't look sensitive by filename alone.
