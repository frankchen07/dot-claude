---
name: setup-shopify-headless
description: >
  Guidance for building and debugging headless Shopify Storefront API integrations
  in Next.js/React/any custom frontend. Covers the common auth-failure debugging
  checklist (token type confusion, password-protected stores, stale API versions),
  the B2B/wholesale + subscription architecture pattern (Customer Account API,
  buyer identity, company catalogs), running multiple headless sales channels off
  one store (per-channel Storefront tokens, Markets/@inContext gotchas), and
  client-side cart mutations (why the Storefront token must be exposed to the
  browser bundle, e.g. NEXT_PUBLIC_ in Next.js). Use when integrating Shopify's
  Storefront API, debugging 401/UNAUTHORIZED errors or empty product results,
  wiring up cart/checkout, or scoping wholesale/B2B accounts alongside individual
  purchases or subscriptions.
---

# Shopify Headless Commerce

## Auth-failure debugging checklist

Work through these in order before assuming the integration code itself is broken —
in practice the code is usually fine and the failure is store-side configuration.

1. **Token type confusion.** Shopify's custom-app "API credentials" page shows two
   separate tokens: an **Admin API access token** and a **Storefront API access
   token**. Both are prefixed strings now (Admin tokens as `shpat_...`; Storefront
   tokens have since picked up their own prefix too, e.g. `shpss_...` — don't assume
   an unprefixed 32-char hex string is required, that's outdated). A prefix alone
   doesn't prove which one you have — confirm the value came from the "Storefront
   API access token" box specifically, not "Admin API access token." Using the
   wrong one produces a generic, unhelpful auth error, not a clear "wrong token
   type" message.

2. **Password-protected store lock.** A `401` from the Storefront GraphQL endpoint
   with a blank/empty error `message` and `content-type: text/html` (instead of
   `application/json`) is a strong tell that the store itself is gated, not that
   credentials are wrong. Diagnose by requesting the bare storefront root with
   redirects disabled:

   ```js
   fetch(`https://${domain}/`, { redirect: "manual" })
     .then(r => console.log(r.status, r.headers.get("location")));
   // 302 -> https://{domain}/password  means the Online Store channel is gated
   ```

   This lock is independent of plan tier, trial status, or billing — a store can
   be on a fully paid plan and still show the password/"coming soon" page until a
   human disables it under **Online Store → Preferences → Restrict access with a
   password**. Don't chase token/scope theories if this redirect is present; fix
   this first, then re-test.

3. **Stale API version.** The endpoint path bakes in a version:
   `https://{domain}/api/{version}/graphql.json`. Shopify ships new stable
   versions quarterly and deprecates old ones. Don't trust a remembered or
   training-data version number — verify the current stable version (check
   shopify.dev's changelog / a quick search) before hardcoding it, and revisit it
   again if picking this back up much later.

4. **Scopes saved AND app installed.** A Storefront access token box only appears
   on the API credentials tab after Storefront API scopes are checked under
   **Configuration** and saved, and the app is then explicitly **installed**. If
   the token section isn't showing up at all, this is almost always why.

5. **Silent mock-data fallbacks hide real failures.** A common pattern (including
   scaffolded starter code) is `try { return realFetch() } catch { return
   MOCK_DATA }`. This is convenient early on but means "why do I still see fake
   data" can silently mean "the real call is failing," not "the feature isn't
   wired up." When debugging this symptom, check for a swallowed catch block
   before assuming the API integration itself doesn't exist yet.

## B2B / wholesale + subscription architecture pattern

- Shopify's B2B feature set ("B2B for all," shipped April 2026) put company
  profiles/catalogs on Basic/Grow/Advanced plans, not just Plus. Catalog-count and
  other caps have been in flux — re-verify current limits per plan when this
  comes up rather than assuming what was true even a few months prior.
- Shopify customers are keyed by **email**. A single Customer record can
  simultaneously be an individual retail buyer and a contact on one or more
  Company profiles — there is no "two separate accounts" problem by default. The
  actual design question is the *UX* of switching between "buying for myself" vs.
  "buying for my company," not the data model.
- **Headless B2B requires the Customer Account API** (Shopify's hosted OAuth login
  for custom storefronts) — the classic fully-anonymous Storefront API flow
  (create a cart with no buyer identity, as most simple headless starters do)
  cannot carry company/buyer context. To get company-catalog pricing, the cart
  needs `customerAccessToken` + `companyLocationId` attached via
  `cartBuyerIdentityUpdate`, which means the customer must actually be logged in
  through the Customer Account API first. If an existing storefront has zero
  login/auth today, adding B2B is a **substantial net-new build** (full OAuth
  login flow, company/location resolution, buyer-identity-aware product pricing
  queries) — flag this explicitly when scoping, don't treat it as a small
  addition on top of an anonymous storefront.
- Third-party subscription apps (Recharge, Bold, Appstle, etc.) are migrating to
  Shopify's **Customer Account UI extension** model so their management portal
  lives inside the native Customer Accounts login rather than a separate
  magic-link system. Check the app's migration status before assuming a single
  unified account portal for both subscriptions and everything else.
- **Known unknown, always validate empirically rather than assume:** whether a
  subscription app's recurring selling-plan price actually respects a logged-in
  buyer's B2B company/catalog price, or silently falls back to standard retail
  pricing regardless of buyer identity. This is the single highest-risk unknown
  in a wholesale-plus-subscriptions build. Test with one real Company + Location +
  Contact and one real subscription product, and actually check the price on the
  resulting order, before building any UI around an assumption either way.

## Multiple headless channels on one store

Shopify supports multiple "Headless" sales channels on a single backend store;
each gets its own Storefront API token, and product/collection queries auto-scope
to whatever's published to that channel. This is a clean way to build a second,
differently-catalogued storefront (e.g. a link-gated wholesale shop) without any
login/Customer Account API work — as long as pricing doesn't need to vary per
buyer (one shared price list for everyone who has the link).

- **Gotcha (confirmed by direct testing):** `@inContext(country: X)` filters by
  Shopify **Markets**, not just by channel. A newly created channel isn't
  automatically added to the Markets an existing channel already belongs to — so
  a query using `@inContext(country: "US")` can return zero products on a channel
  that has correctly published, queryable products, while the identical query
  *without* `@inContext` returns them fine on the same token. The symptom looks
  like "products aren't published" or "token is wrong," but neither is true.
- Fix is either: add the new channel to the relevant Market in Shopify Admin
  (Settings → Markets), or — if the storefront doesn't need market-specific
  pricing/currency — just drop the `@inContext(country)` directive for that
  channel's queries and let it resolve against the shop's default market.
- **Debugging technique:** isolate with a minimal raw GraphQL query (curl or a
  throwaway Node script) directly against
  `https://{domain}/api/{version}/graphql.json` with the specific token, varying
  one directive/argument at a time (with vs. without `@inContext`, with vs.
  without `sortKey`, etc.) to bisect which part of the query is filtering results
  out. Much faster than guessing from app-level symptoms, and rules out
  token/publishing issues before chasing app code.

## Client-side cart mutations need a client-exposed token

If cart create/add/update/remove runs directly from browser code (a `"use
client"` component in Next.js, or the equivalent in any other framework) rather
than through a server route/action, the Storefront domain + token must ship
inside the client bundle — not just be readable server-side. In Next.js this
means the `NEXT_PUBLIC_` env var prefix (other frameworks have their own
equivalent: Vite's `VITE_`, CRA's `REACT_APP_`, etc.); a plain server-only env
var resolves to `undefined` in the browser and the fetch throws immediately.

- This is safe to do: Shopify's Storefront API access token is explicitly
  designed to be public/client-safe — unlike the Admin API token, it can only do
  what an anonymous storefront visitor could already do (read published products,
  create/mutate a cart). No need to proxy cart mutations through a server route
  purely to keep this token secret.
- **Symptom to recognize:** a generic "credentials not configured" (or
  equivalent undefined-token) error that reproduces only when a real user clicks
  "Add to Cart" in an actual browser — curl/SSR checks against the same page
  won't catch it, because they only exercise the server-rendered path, not the
  client-side cart code path. Don't assume the integration is broken store-side;
  check whether the failing call is running client-side with a
  server-only-scoped env var first.
