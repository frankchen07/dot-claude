---
name: setup-claude-mcp-connector
description: >
  How to build a self-hosted MCP server and connect it to Claude.ai as a
  Custom Connector, so a normal Claude.ai conversation — including mobile
  voice dictation — can call real tools against the user's own app or data,
  bypassing Anthropic's credit-limited built-in integrations (Autosheet,
  Gmail, Drive) entirely. Covers the auth model (static bearer token vs.
  OAuth), the Next.js/Vercel build pattern with `mcp-handler` (generalizes to
  any backend), and Claude.ai connector-setup gotchas. Use this whenever the
  user: wants Claude.ai chat/voice to read or write to their own
  app/database/spreadsheet; asks "can Claude.ai talk to my app"; mentions
  building or debugging an "MCP server," "MCP connector," or "custom
  connector"; hits "out of Autosheet credits" or a similar built-in-feature
  quota wall and wants a workaround; or reports symptoms like a greyed-out/
  missing "Authorization" header field in Claude.ai's connector dialog, a 401
  from a connector that "should be connected," or "Request headers" not
  showing up in the connector setup screen. Trigger even if the user never
  says "MCP" explicitly.
---

# Custom MCP connector for Claude.ai

## When this is the right tool

Claude.ai's built-in integrations (Autosheet, Gmail, Drive, etc.) are
Anthropic-hosted and credit-limited. If the user has their own app with its
own data access already working (e.g. a service-account-backed Sheets
integration), a self-hosted MCP server sidesteps those credits entirely and
gives you full control over the tool's behavior. Point this out explicitly if
the user is hitting a credits/quota wall on a built-in integration — they may
not realize the two are unrelated.

## Debugging an existing connector? Jump straight there

If the user already has a connector and something's broken, skip ahead —
don't re-derive from scratch:

- Greyed-out / missing "Authorization" header option in the connector dialog
  → [Wire it up in Claude.ai](#wire-it-up-in-claude-ai-settings--connectors--add-custom-connector),
  Authentication mode gotcha.
- 401s, or a connector Claude.ai calls "connected" but nothing actually
  writes → [Verify without guessing](#verify-without-guessing).
- "Request headers" section doesn't appear at all in the dialog →
  it's a beta feature gated per Claude.ai organization, not a server bug —
  see [Wire it up in Claude.ai](#wire-it-up-in-claude-ai-settings--connectors--add-custom-connector).

## Build the server

- Package: `mcp-handler` (Vercel's Next.js adapter for the MCP SDK). Pin
  compatible versions — at time of writing `mcp-handler@2.1.1` needs
  `zod@^4`; check its peer deps before installing, version mismatches fail
  silently-ish (schema validation breaks, not an install error).
- One route file, e.g. `src/app/api/mcp/route.ts`:
  - `createMcpHandler((server) => { server.registerTool(name, {title, description, inputSchema: z.object({...})}, async (args) => {...}) })`
  - Return shape is `{ content: [{ type: "text", text: <string> }] }` — stringify
    structured results (JSON.stringify), don't return raw objects.
  - **Tool design**: when matching user input against real data (item names,
    IDs, etc.), report back what *didn't* match instead of guessing or
    silently dropping it. The model can then ask the user to clarify a
    misheard/mistyped value in the same conversation turn, rather than
    writing garbage or failing the whole call.
  - Reuse existing internal functions for the actual side effect (DB write,
    API call) rather than reimplementing it — the MCP tool should be a thin
    wrapper around code that already works and is already tested.

## Auth: skip OAuth for single-user tools

- A static bearer token checked in the route handler is the right scope for
  "one person's own app, one person's Claude.ai account" — not OAuth. OAuth
  (Dynamic Client Registration / Client ID Metadata Documents) is Anthropic's
  mechanism for third-party services with many users; it's overkill here and
  was confirmed as correctly-scoped by an overengineering review.
- Generate a long random token, store as an env var (e.g. `MCP_ACCESS_TOKEN`),
  check `Authorization: Bearer <token>` manually inside the route:
  ```ts
  function isAuthorized(request: Request): boolean {
    const header = request.headers.get("authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    return Boolean(process.env.MCP_ACCESS_TOKEN) && token === process.env.MCP_ACCESS_TOKEN;
  }
  ```
  Note the `Boolean()` wrapper isn't decorative — under TS strict mode,
  `process.env.X && token === process.env.X` types as `string | undefined |
  boolean`, not `boolean`, and fails a declared `boolean` return type.
- If the app already gates every route behind its own cookie-based auth
  (middleware), **exclude the MCP route from that gate** — an MCP client
  can't hold a browser cookie. In Next.js, add the route path to the
  middleware matcher's negative-lookahead exclusion list, same pattern
  usually already used for a login/auth-callback route:
  ```ts
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/login|api/mcp|login).*)"]
  ```

## Wire it up in Claude.ai (Settings → Connectors → Add custom connector)

- **MCP server URL**: the deployed `/api/mcp` endpoint (must be publicly
  reachable — localhost doesn't work here).
- **Authentication: must be "No sign-in."** This is the load-bearing gotcha.
  If Authentication is set to "Sign in now" / "Sign in when needed" (OAuth
  modes), Claude.ai reserves the `Authorization` header for its own OAuth
  flow and **will not let you type it manually** — it disappears or greys
  out as a header name option. Only under "No sign-in" can you add a static
  `Authorization` header yourself.
- **Request headers**: add `Authorization` = `Bearer <MCP_ACCESS_TOKEN>`.
  This "Request headers" section is currently **beta and gated per Claude.ai
  organization** — if it doesn't appear in the dialog at all, it isn't
  enabled for that account yet (not a bug in the server).

## Verify without guessing

- Don't wait for a real dictation test to know if auth is wired correctly.
  Check `vercel logs --json` (or equivalent platform log) for the actual
  request/response — a `401` means the header isn't reaching the server
  correctly (or wasn't set because of the OAuth-mode gotcha above); a `200`
  on `initialize`/`tools/list` confirms the handshake works even before any
  real tool call has landed.
- Cross-check against the actual downstream system (the sheet, the DB row)
  to confirm a real tool *call* — not just the handshake — produced the
  expected side effect.

## Don't over-build quota handling

For a single-user, chat-driven tool, call volume is trivially low against
typical API quotas (e.g. Google Sheets' default 60 read + 60 write
requests/min *per user*) — a dictated update might cost 4-5 API calls, so
you'd need ~15-20 dictations/minute to threaten the limit. Don't add
caching/batching/rate-limiting up front for this shape of usage; it's
premature until the actual usage pattern changes (many users, high-frequency
automation).
