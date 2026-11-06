# Syncing ~/.claude between machines with git

**Date**: 2026-11-05

## The problem
Tracking `~/.claude` produced constant "sync state" commits and `/Users/<name>` paths, because Claude Code writes its own plugin state into the same directory.

## The solution / decision
- `.gitignore` is an allowlist: ignore `/*`, then opt in `CLAUDE.md`, `settings.json`, `agents/`, `skills/`, `mods/`, and the files they depend on.
- `setup.sh` handles what git can't carry: marketplace registration, plugin installs, and the pre-push hook.
- Marketplaces are added with `--scope local`. It writes to the ignored `.claude/settings.local.json`, and the plugins still load from any directory.
- Tradeoff: new top-level files have to be allowlisted by hand, and memory, plans, and MCP servers stay per-machine.

## Why it wasn't obvious
- `claude plugin marketplace add` defaults to user scope, which writes `extraKnownMarketplaces` with an absolute path into `settings.json`. Deleting that block doesn't last if you then follow the usual install steps.
- A fresh machine doesn't have `claude-plugins-official` registered, so installing from it fails until it's added.
- `git rm --cached` only keeps files on the machine that ran it. Other clones get a real delete on pull, or an abort if Claude Code has changed those files. The first update on an older clone needs `git fetch && git reset origin/main && git restore .`, which leaves untracked files alone.
- A fresh Claude Code run can rewrite `model` from `opus` to `opus[1m]` in `settings.json`. In testing it happened once and didn't return after `git restore settings.json`.
- Test with `HOME=$(mktemp -d)` and a copy of `git ls-files`. Running against the real home hides all of the above, because existing state masks the gaps.

## Pointers
- `.gitignore`, `setup.sh`, README "Setup on another machine"
- `claude plugin marketplace add --help`
