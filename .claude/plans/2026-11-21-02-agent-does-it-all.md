# The agent can do it all: a browser signed in from the CLI, a host to drive, then the map app

Status: 2026-11-21, approved ("Okay.") after the user asked: "If this is all going to work, we
need to change how it works so it's easy for you to also do it all." Builds on plan
2026-11-21-01 (each command written once, void-commands).

## Why

The goal is the coverage map shown inside an AI's chat (an MCP App), tested for real: signed in
from Claude, as anyone would. Two things stopped the agent doing that alone:

- Signing a browser in: `/login` takes a password, which the agent must never type.
- Seeing an app rendered: Claude in Chrome refuses claude.ai ("Navigation to this domain is not
  allowed"), and basic-host (the MCP Apps reference host) can't sign in.

Both are ours to fix, except claude.ai itself.

## What Claude needs (its docs, read 2026-11-21, checked against the live server)

- Registration: Claude uses its published identity (CIMD) when the authorization server says
  `client_id_metadata_document_supported: true` and lists `none`; ours does. Otherwise DCR.
- Return address for claude.ai, Desktop and mobile: `https://claude.ai/api/mcp/auth_callback`.
- Scopes: with no `scope` in the 401's `WWW-Authenticate` (ours has none), Claude asks for the
  protected resource's `scopes_supported` (ours: `tests`), plus `offline_access`.
- Requests come from Anthropic's servers (160.79.104.0/21), not the browser.
- Tool results are cut at about 150,000 characters. `coverage` for the world is 194,347: too big.
- MCP Apps render on a subdomain of `claudemcpcontent.com`; `_meta.ui.domain` (the first 32 hex
  of the SHA-256 of the server URL) keeps it stable. Every external origin is blocked unless
  `_meta.ui.csp` names it, so the app carries everything it needs (the world outline too:
  `<use href="/world.svg#land">` can't reach our site from there).

## 1. `cloudflare-ping open [<page>] [--browser <app>]`: a browser signed in from the CLI

The CLI is signed in (device login, approved once). `open` asks the app for a one-time sign-in
token (Better Auth's own `oneTimeToken` plugin: one use, 3 minutes, stored hashed, in the
`verification` table it already has, so no migration) and opens the browser at
`/open?to=<page>#token=…`. The page (pages/open.tsx) sends the token to Better Auth's verify
endpoint, which sets the session cookie, then goes to the page. The token is in the fragment, so
it never reaches a server log; the CLI never prints it.

- The browser gets the CLI's own session: signing out in the browser signs the CLI out too.
- `--browser` (or `BROWSER`): which browser; this Mac's default is Safari, and the agent drives
  Chrome. macOS: `open -a <app>`.
- One definition in the commands list (CLI only, signed in), so the help, docs and skill follow.

## 2. `vp run mcp:host`: a host the agent can drive

The official MCP Apps host pieces (`@modelcontextprotocol/ext-apps` 2.0.4, npm's latest, 27
October; the SDK's `AppBridge`), on 127.0.0.1. It signs in as `mcp:check` does (the same code,
shared), lists the tools, calls one, and shows its app in a sandboxed frame with the default
"block every external origin" policy Claude uses. The agent opens it in Chrome and sees the app
as a host shows it.

## 3. The coverage map, as an MCP App

- A definition says it has one (`app: { title }`), as it says `resource` now; void-commands
  registers the tool's `_meta.ui.resourceUri` and the `ui://` resource (`registerAppTool`,
  `registerAppResource`), with the `_meta.ui.domain` Claude wants.
- The view is built into one HTML string at build time by a small Vite plugin (as yagipass/nestodo
  does in its Void app: `virtual:stats-app`), so the Worker reads nothing from disk.
- The view is the site's own map: `src/WorldMap.tsx` and the coverage answer turned into points by
  code shared with pages/coverage.tsx. Nothing drawn twice.
- The size: measured first (the tool's text and structured answer both count), then decided.

## Proof

- `mcp:check`: every tool with an app points at it, and the resource serves its page.
- `mcp:host`: the agent calls `coverage` and sees the map, screenshot and all.
- Claude: `open` signs Chrome in, so the consent page needs no password. Adding the connector in
  claude.ai needs claude.ai: the user, or the extension if it can be allowed there.
- Nothing here spends tests.

## Done, 2026-11-21

1. `cloudflare-ping open` (6351ba2): deployed, then `open /runs --browser "Google Chrome"` signed
   the agent's Chrome in. Its top bar showed the account and "Sign out"; no one typed a password.
2. `vp run mcp:host` (a2d970e): the sign-in is one shared file now (scripts/mcp-sign-in.ts). The
   first run crashed on an unhandled HTTP/2 idle timeout: an answer left open under Node's fetch.
   Fixed: only POST goes on (the app's /mcp has no stream to hold open), an answer read to the end
   or cancelled, and no leftover client at the start.
3. The coverage map app (6037516): deployed; `mcp:check` passed, the app's page served (528,390
   characters: React, the Apps SDK, zod, the world's outline). In `mcp:host`, from the live server:
   - Thailand: the map zoomed in, its 3 data centres and 24 probe cities. Answer: 8,634
     characters (11,147 before the text answer was made compact).
   - The world with `cities: false`: 115,760 characters, under Claude's ~150,000; the app drew
     every city, asked for a continent at a time.
   - The world as asked by default (cities included): 423,850 characters, nearly three times
     Claude's limit. The default was the user's decision (plan 2026-11-20-04), so it's theirs.

Still open: the user's decision on that default; and the app seen inside Claude itself, which
needs claude.ai (Chrome is now signed in to cloudflare-ping, so Claude's sign-in needs no
password there).
