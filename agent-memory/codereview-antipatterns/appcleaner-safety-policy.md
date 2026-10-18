---
name: appcleaner-safety-policy
description: appclean (Swift macOS uninstaller) safety review: what's solid, what's brittle (bundle-ID trust, appBundle evidence scope, leftovers OwnershipIndex fail-open, LaunchAgents tiering)
metadata:
  type: project
---

Reviewed 2026-10-11. Path layer (PathValidator: lstat every component, direct-child-of-root allowlist, uid/dev checks, identity recheck) is solid; don't re-flag.

Intentional, not bugs: deniedPrefixes exempt paths under home; Group Containers discoverable-but-never-removable; app bundles owned by root are blocked (fail-closed); CLI and Remover both check isRunning (Remover must re-derive).

Brittle spots to recheck next time:
- Identity comes from an unauthenticated, user-writable Info.plist; a second copy of an app (Downloads/DMG) with the same bundle ID makes "remove the copy" trash the real app's data. teamID never required for high confidence.
- SafetyPolicy grants `.appBundle` high evidence when path == app.url regardless of root kind, so a `.app` directly in a Library root is approved without association.
- (Fixed by 2026-10-12: Remover now throws auditLogFailed instead of `try?`.)
- Tests assert `blockReason != nil` without the reason, so forged-target tests can pass for the wrong reason; swap test is caught by symlink check, not dev/ino.

GUI (AppCleanUI, reviewed 2026-10-12): selection-only-shrinks is real (removalTargets filters approved; Remover re-evaluates from disk), and any appclean copy is blocked by Remover's isRunning since the GUI itself runs. Brittle: UninstallModel.load() resets `deselected` on every rescan (toggle, post-failure) so unchecked items silently re-check; remove/load Tasks not guarded by currentURL so drops during removal cross-wire state; failure path overwrites errorMessage and drops partial records.

Leftovers feature (reviewed 2026-10-12): orphan eligibility = absence of owner signals in OwnershipIndex. Recheck next time:
- OwnershipIndex.run() swallows launch failure/exit status; empty mdfind/launchctl output silently shrinks sets (fail-open) with no scan warning.
- Spotlight does NOT index nested bundles (helpers/appex/xpc); installedApps only records top-level IDs, so cross-vendor embedded IDs (e.g. Docker's com.electron.dockerdesktop) are invisible.
- LaunchAgents is in appOnlyRoots (ready by default) though Homebrew + hand-written agents live there; program check treats any lstat failure as "gone"; loaded check keys on filename not plist Label.
- Intentional (tested): Group Containers are ready in leftovers despite non-removable in uninstall flow; running check is exact-ID only.
- Scan vs removal evaluation is consistent (same evaluate + fresh index + identity); Remover refactor kept app-last order, dedup, audit throw.

Deleted-app evidence (KnownApps + Trash, reviewed 2026-10-12): `parts[1]` in ownerBlock is SAFE (ownerID guarantees >=2 components); don't re-flag. LaunchAgents loaded check now uses filename AND plist Label (fixed). Weak spots:
- Plain-name branch (App Support/<AppName>) only checks appNames (appRoots-only) + ownerBlock on the deleted app's ID: misses Homebrew formula with the same name (e.g. Syncthing), appclean's OWN support dir (CFBundleName "appclean" -> history.jsonl/known-apps.json become review), Apple plain folders.
- KnownApps "deleted" = remembered + absent now; upgrades Caches/Preferences/App Support to ready on absence alone (app moved to unmounted volume, cross-vendor bundle-ID rename). Doesn't store last-seen path.
- KnownApps decode failure throws before write -> permanent warning, memory frozen.

**How to apply:** start future reviews of this repo at SafetyPolicy/Remover/AppInfo trust boundaries, not PathValidator. See [[native-dialog-to-react-modal]] for unrelated checklist style.
