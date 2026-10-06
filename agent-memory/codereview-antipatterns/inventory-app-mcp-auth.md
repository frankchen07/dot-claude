---
name: inventory-app-mcp-auth
description: inventory-tracker auth — HMAC session cookie keyed on AUTH_SECRET (not passphrase), safeEqual compares; MCP still skips withMcpAuth; proxy.ts matcher unanchored prefixes
metadata:
  type: project
---

`src/app/api/mcp/route.ts` implements `record_inventory_count` via `mcp-handler`'s
`createMcpHandler`, gated by a hand-rolled `isAuthorized()` bearer-token check
(`token === process.env.MCP_ACCESS_TOKEN`, non-timing-safe, fails closed if the
env var is unset).

**Known gap, not yet fixed (as of 2026-09-15):** `mcp-handler` ships
`withMcpAuth`/`experimental_withMcpAuth` (see `node_modules/mcp-handler/dist/index.d.ts`)
which handles the MCP-spec-correct 401 + `WWW-Authenticate` + RFC 9728
protected-resource-metadata response and sets `request.auth`. The route bypasses
this and does a plain string check instead — works, but doesn't speak the
OAuth-discovery shape MCP clients may probe for. Matches this codebase's existing
plain `!==` comparison convention in `src/app/api/login/route.ts`, so it's
consistent style, not a one-off regression — but worth re-flagging if this route
gets exposed beyond a single trusted client.

**proxy.ts matcher gap:** `src/proxy.ts`'s negative-lookahead matcher
(`(?!_next/static|_next/image|favicon.ico|api/login|api/mcp|login)`) is an
unanchored prefix match — any future route literally starting with `api/mcp`
(e.g. `api/mcp-debug`) would also skip the passphrase gate. Pre-existing pattern
(same issue already present for `api/login`), just duplicated rather than fixed
when `api/mcp` was added. Low risk while only one such route exists — check this
again if new `api/*` routes get added near either prefix.

Related: [posnos-upsert-race] for another instance of this codebase reaching for
a manual/hand-rolled approach where a library primitive already exists.

**Update 2026-10-04 (uncommitted at review time):** cookie became `${expiresMs}.${hmac}`
signed with `AUTH_SECRET`; passphrase + MCP token now compared via sha256+timingSafeEqual
`safeEqual` in `src/lib/auth.ts` (verified correct). Watch-items: (1) HMAC key excludes
the passphrase, so rotating APP_PASSPHRASE no longer revokes sessions — only rotating
AUTH_SECRET does; (2) missing AUTH_SECRET fails closed but login page shows
"passphrase didn't match" (misleading). Proxy on Node runtime (Next 16 default), so
node:crypto import there is intentional, not an Edge bug.
