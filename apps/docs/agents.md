# From an AI agent

cloudflare-ping is an MCP server, so an AI agent can use it as it uses any other tool:
`https://cloudflare-ping.gedw99.workers.dev/mcp`. The agent signs itself in, in your browser,
as you, and then has what the CLI has, as tools.

<script setup>
import { data } from "./cli.data";
</script>

## Add it

In Claude Code:

```sh
claude mcp add --transport http cloudflare-ping https://cloudflare-ping.gedw99.workers.dev/mcp
```

Then `/mcp`, choose `cloudflare-ping`, and Authenticate.

Other agents (Cursor, VS Code, Codex, Gemini CLI, opencode) take the same URL in their MCP
settings. Nothing else is needed: the server tells the agent where to sign in.

## Set a project up

In a project whose agents should use the app, run `npx cloudflare-ping init` in its root (once the
package is published; until then, `node <this repo>/packages/cli/dist/main.mjs init`, after
`vp run cli:pack`). As
`void init` sets agents up for Void, it finds each coding agent by its folder (`.claude`,
`.cursor`, `.codex`, `.gemini`, `.opencode` and the rest Void knows), then:

- puts the app's skill (`cloudflare-ping`: when to use the app, and how) in each agent's skills
  folder: linked when the package is installed in the project, copied otherwise;
- adds a short cloudflare-ping section to `AGENTS.md`, leaving the rest as it is;
- adds the MCP server to Claude Code's `.mcp.json`, and prints each other agent's way to add it
  (opencode: `opencode mcp add cloudflare-ping --url …`).

Running it again changes nothing that's already there.

## Signing in

1. The agent opens the app's sign-in page in your browser, with a notice that an agent is asking.
2. Sign in, with an account the app allows (the same one as on the web and in the CLI).
3. The app asks whether to allow the agent, by its name, as you. Allow, or Deny.
4. The agent gets a token for `/mcp` only, which it renews by itself. Allowing the same agent
   again isn't asked twice.

The agent can't make an account, and can't use anything but the tools below. Starting a run or
a test spends Globalping tests, as it does from the web and the CLI.

## The tools

Each tool is a command (the same list, the same words, the same code as the page and the CLI):

<ul>
  <li v-for="command in data.commands.filter((each) => each.tool)" :key="command.name">
    <code>{{ command.tool }}</code>: {{ command.about }}. The same as
    <code>cloudflare-ping {{ command.name }}</code>.
  </li>
</ul>

## How it's built

`/mcp` is a Void route (`apps/web/routes/mcp.ts`) serving the official MCP SDK
(`@modelcontextprotocol/server`), a fresh server per request. Signing in is Void's own auth with
Better Auth's MCP plugin (`apps/web/auth.ts`): it is the OAuth server, binds each token to
`/mcp`, and lets an agent register itself, by its metadata document's URL or by Dynamic Client
Registration. The discovery documents are at
`/.well-known/oauth-protected-resource/mcp` and `/.well-known/oauth-authorization-server/api/auth`.
