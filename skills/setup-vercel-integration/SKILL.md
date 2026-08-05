---
name: setup-vercel-integration
description: >
  Gotcha for `vercel integration add <provider>` when the user already has an
  existing account/resource with that provider (a Shopify store, a database,
  etc.) — the CLI defaults to auto-provisioning a brand-new sandbox resource
  rather than connecting to the existing one. Use before running
  `vercel integration add` whenever the user has mentioned they already have an
  account with that provider, and when cleaning up an incorrectly
  auto-provisioned sandbox resource.
---

# Vercel Marketplace: Existing Resource Gotcha

## The gotcha

`vercel integration add <provider> --no-claim` will happily succeed and print
something like:

```
> Success! Shopify successfully provisioned: shopify-erin-village
> Sandbox resource — claim it later with: vercel integration resource claim shopify-erin-village
```

That "successfully provisioned" resource is a **brand-new sandbox**, not a
connection to any account the user already has with that provider. It's easy to
read this output as "great, it connected my store" when it actually spun up an
unrelated one. If the user already has a real account/store/database with this
provider, running `add` without checking first can leave them with two disconnected
resources (their real one, untouched and unused, plus this new sandbox).

## Before running `add`

If the user has said (or it's plausible) they already have an account/resource
with this provider, stop and ask which they want:

1. **Use the new sandbox** — claim it into their real account
   (`vercel integration resource claim <name>`), and treat it as the resource
   going forward. Simplest path, but likely means abandoning whatever they
   already set up manually.
2. **Connect the existing resource instead** — remove the auto-provisioned
   sandbox, then get real credentials directly from that provider's own
   dashboard/admin and set them as env vars manually (bypassing the Marketplace
   auto-provision flow entirely).

This is the user's call, not something to decide unilaterally — the two paths
have real consequences (which store/db is actually "production" going forward).

## Cleanup if the sandbox path was taken by mistake

```bash
vercel integration-resource remove <resource-name> --disconnect-all --yes
vercel integration remove <provider> --yes
```

Then scrub any already-pulled `.env.local` of the stale sandbox values (a
`vercel env pull` run before cleanup will have written them locally).

## Practical `vercel env add` notes

- Pipe secret values via stdin rather than passing them as a literal in
  `--value`, so the raw secret never appears in a logged/echoed command string:

  ```bash
  printf '%s' "$SOME_SECRET" | vercel env add SOME_SECRET production,preview --yes
  ```

- `--sensitive` is **not allowed** on the `development` environment target
  (`sensitive_not_allowed_on_development`). Add Development separately without
  that flag if you need the var in all three environments:

  ```bash
  printf '%s' "$SOME_SECRET" | vercel env add SOME_SECRET production,preview --sensitive --yes
  printf '%s' "$SOME_SECRET" | vercel env add SOME_SECRET development --yes
  ```

- Environments accept a comma-separated list in one call
  (`production,preview,development`) — no need for one invocation per
  environment unless sensitivity rules force a split, as above.
