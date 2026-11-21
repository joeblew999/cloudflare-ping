# 2026-11-21-01-commands-once.md: each command written once, every surface made from it

Status: 2026-11-21, approved in the conversation ("do it all"), built and proven locally the same
day (see "How it was proven"); deployed and checked live 2026-11-21 ("Still open"). Found from
the repo as it was (commit ed02c31), Void 1.11.0's docs (`node_modules/void/docs`), the MCP SDK
2.4.0's and Better Auth 1.7.26's own types, and three other Void apps serving MCP, checked on
2026-11-21: elecdeer/tsuke (`apps/ledger/routes/mcp.ts`, `src/mcp/server.ts`), yagipass/nestodo
(`apps/web/src/mcp-server.ts`, its `virtual:stats-app` Vite plugin) and
mizchi/mcp-oauth-playground.

## Why

Plan 2026-11-20-01 got the shape right: the MCP tools, the API routes and the pages all run the
same functions in `src/commands/`, in the Worker. What was wrong is everything around them:

- **The command list was a second copy, in strings.** `COMMAND_LIST` (`packages/shared/src/commands.ts`)
  described each command (`api: "POST /api/probe"`, `use: "test [--from TH] …"`, `tool: "test"`),
  while the real schema and function were in `src/commands/`, the tool in `src/mcp.ts`, the
  route in `routes/api/`, the flags in `packages/cli/commands/`. Nothing tied them together;
  `questionFor` parsed the `api` string back apart, and `signedInFor("run", c)` looked a command
  up by a name in a string.
- **Ten `registerTool` calls by hand** in `src/mcp.ts`, described for people ("the same as
  `cloudflare-ping test --from TH`"), not for the AI.
- **Errors as HTTP codes** thrown from the commands (`HTTPException(404)` in `show`, 403 in
  `run`, 503 in `trace`), which the MCP side only got right by catching every `Error`.
- **No output described**, nothing for work that goes on after the reply (`run`, `remap`), every
  token able to spend tests, nothing stopping an AI's retry from spending twice.

## The design

### A package: `void-commands` (`packages/void-commands`)

Void has no MCP, and void-fbtee's events app needs exactly the same thing, so the machinery is
its own package, made for any Void app. cloudflare-ping is the first app on it and its proof.
It's private for now, in this workspace; publishing it is a later step (step 7 below).

- `void-commands` (anywhere: Worker, Node, the CLI): `defineCommand`, the failure kinds.
- `void-commands/server` (the Worker): `fail`, `implement`, `commandsMcpServer`, `openApiOf`.
- `void-commands/cli` (Node): the usage line and help for a command, the exit code for a failure.

### 1. A command is one definition (`packages/shared/src/commands.ts`)

```ts
export const show = defineCommand({
  name: "show",
  about: "One run and its fetches",
  input: z.object({ id: z.string().min(1).max(64).describe("The run's ID, as runs lists it") }),
  api: { method: "GET", path: "/api/runs/[id]" }, // a Void route path: a typo doesn't compile
  page: "/runs/<id>",
  task: "ping:show",
  signedIn: false,
  spends: false,
  cli: { argument: "id", flags: {} },
});
```

The definitions are in `packages/shared`, because the CLI and the docs can't import Worker
code. They hold no code that runs a command. `COMMAND_LIST` becomes the list of these objects.

### 2. The code is `implement(definition, output, run)`, beside it in the Worker (`src/commands/`)

`implement` takes the definition, an **output schema**, and the function. The function's input
type comes from `definition.input`; its return type must fit the output schema, which the
compiler checks. Database rows in the outputs come from the Drizzle tables with
`createSelectSchema` (`void/drizzle-zod`, Void's own way: `guide/database.md`), so they aren't
written twice. The output schema is what the MCP tool's `outputSchema` says, what the SDK checks
`structuredContent` against, and what the OpenAPI document says.

### 3. Failures are kinds, not HTTP codes

A command throws `fail(kind, words)`: `not_found`, `not_allowed`, `signed_out`, `out_of_tests`,
`not_set_up`, `refused` (another service said no) or `bad_input`. One table in the package says
what each kind is on each surface: an HTTP status for the API and the pages, `isError` with the
words for MCP, an exit code for the CLI. The error is a Hono `HTTPException` underneath, so Void's
own handling still shows the right page (`_not-found` for `not_found`, the words in a form's
error), which is Void's documented way (`guide/pages-routing/errors.md`). The code in
`src/commands/` never writes a status; the table does.

Why throw instead of returning `{ ok, error }`: every layer below the commands (`src/globalping.ts`,
`src/runs.ts`) throws already, and Void's handler contract is that the return value is the
answer. Returning results would mean unwrapping in every route and page for nothing.

### 4. Every surface is made from the list

- **MCP:** `src/mcp.ts` is one call, `commandsMcpServer({ commands, … })`, which loops over the
  implementations: name, a description written for the AI (`about`, plus what each field means,
  from `.describe()` on the schemas), input and output schemas, and annotations from `spends`.
- **API routes:** stay Void files (Void finds routes by file, and typed fetch gets its types
  from them), each calling `runCommand(c, command, input)`, which signs in when the definition
  says so, runs it, and logs it. `signedInFor` and its string lookup go.
- **Pages:** their loaders and actions call the same `runCommand`.
- **CLI:** each command file keeps its own printing and its typed fetch call (both are the
  CLI's), but takes its flags from `definition.cli.flags`, and `help` prints the usage line made
  from them. The `use` strings go.
- **Docs, skill:** read the same list (the usage line from `void-commands/cli`).
- **OpenAPI:** `GET /api/openapi.json`, made from the list (step 12).

### 5. Work that goes on after the reply

`run` and `remap` start work that keeps going. A definition says what follows it:
`follow: { command: "show", by: "id" }`. MCP adds a resource link to the reply
(`cloudflare-ping://runs/<id>`) and says to read it, or call `show`, to see it come in. The CLI
and the pages keep following live as now. No timed waits: the state comes from the run itself.

### 6. Who may spend tests

`signedIn` is enforced for the API and the pages by `runCommand`. For MCP, a command that
`spends` needs the OAuth scope `tests`: `auth.ts` adds it to `mcp()`'s scopes, and each such
tool has the SDK's `requireScopes("tests")`, which answers a token without it with an
`insufficient_scope` challenge so the client can ask for it (the SDK and Better Auth both do
this step-up). An AI client can be given read-only access by not granting `tests`.

A client registered before this change has a capability set without `tests` (Better Auth keeps
it from registration), so it can't step up: remove it and add it again once
(`claude mcp remove cloudflare-ping`, then `claude mcp add …`).

### 7. The CLI against an older or newer app

Already there: `API_VERSION` (`packages/shared/src/version.ts`) and `middleware/02.api-version.ts`
refusing a CLI built for another version, with "update it". This change only adds optional
inputs and output fields (step 11's `cursor` and `next`), so an older CLI still works and the
version stays 1. The rule stays as the README says: raise it when a route changes in a way an
older CLI can't use.

### 8. The same call twice

AI clients retry. An MCP call to a command that `spends`, with the same input, from the same
client and user, within two minutes, gets the first call's answer back, marked as the same call,
and spends nothing. Kept in Void's KV (`void/kv`), keyed by a hash of the client, user, command
and input. Not atomic: two identical calls in the same instant can both run; that's the rare case,
and the retry case is the common one.

### 9. Asking before spending

When the MCP client can ask its user (it declares the elicitation capability, on MCP 2026-07-28:
a stateless server can't ask a 2025-era client, which declares it only on a connection the
server no longer has), a command that
`spends` first asks "This uses Globalping tests: <N> left this hour. Go ahead?", through the SDK's
multi-round-trip `inputRequired` (stateless, as `createMcpHandler` needs). A client that can't
ask gets the tool marked as not read-only, as now, and the AI client's own approval applies.

### 10. More than tools: resources

`show` and `map` are things to read, so they're also MCP resources: `cloudflare-ping://runs/{id}`
and `cloudflare-ping://maps/{id}`, read by the same implementations. A definition says so with
`resource: { uri: "cloudflare-ping://runs/{id}" }`.

MCP Apps (an interactive page shown in the AI's chat, nestodo's `registerAppTool` with a Vite
virtual module) is not in this change: the map and coverage pages are React with the site's
theme, and making one of them a self-contained MCP App is its own piece of work. Carried to
"Still open" below.

### 11. Long lists

`runs` and `places` take an optional `cursor` and say `next` (the cursor for the next lot, or
null). One shape for every surface: the API's query, the CLI's `--cursor`, the MCP tool's input.
The cursor is opaque (the package's `cursorOf` / `readCursor`); for runs it's where the last one
was (time and ID), so new runs don't shift a page.

### 12. Being found

- `GET /api/openapi.json`: an OpenAPI 3.1 document of every command with an API route, made from
  the definitions and output schemas (`openApiOf`), so other tools and SDKs can call the API.
- `GET /.well-known/mcp/server-card.json`: the MCP Server Card (SEP-2127, still a proposal on
  2026-11-21, so its exact path and fields may change): the server's name, its `/mcp` URL and
  transport. The in-protocol `server/discover` is the SDK's own.

### 13. Who did what

`runCommand` (API, pages) and the MCP server both log one line per call with Void's logger: the
command, the surface, the client (`azp` for MCP), the user, how long it took, and whether it
failed and how. Commands that spend say so (`spends: true`). When the hourly tests run out,
Workers Logs shows who used them.

## What goes

- `COMMAND_LIST`'s `use`, `api` strings, `tool`, `argument`; `questionFor`'s string parsing (it
  reads the definition's typed `api.path` and `cli.argument` now).
- `src/mcp.ts`'s `describe()`, `commandOf()`, `hints()`, `answer()` and the ten `registerTool`s.
- `signedInFor` and its lookup by name (`src/commands/context.ts`).
- Every `HTTPException` in `src/commands/` and the code under it (`fail` instead).
- The stale comment in `src/commands/context.ts` ("later, its MCP tool").

## How it's proven

- `packages/void-commands` has one test file that runs a sample command set through the real MCP
  SDK client and server (`InMemoryTransport`, the SDK's own, no mocks): tools listed with input
  and output schemas, an answer, a failure as `isError`, the scope challenge, asking before
  spending, the same call twice, a resource read.
- `vp check`, `vp test`, `vp build`, `vp pack` for the whole repo.
- Locally with `vp dev`: every open API route, `/api/openapi.json`, the server card, `/mcp`
  refusing without a token, the CLI from source against it (`--site http://localhost:5173`).
- After deploy, `vp run mcp:check` (it signs in through the browser, so it runs on the Mac):
  every read-only command asked of MCP, the API and the CLI, identical answers; the tools'
  output schemas; the resources.

## How it was proven (2026-11-21, in a Claude cloud session)

- `vp check` (format, lint, types for every package), `vp test` (11 files, 57 tests, including
  `packages/void-commands/src/server.test.ts`: the real SDK client against the real
  `createMcpHandler`, with a 2025 client and a 2026-07-28 one), `vp run build`, `vp run cli:pack`.
- `vp dev --port 5199`, with a local `.env` (`BETTER_AUTH_SECRET`, `ALLOWED_EMAILS`): every open
  API route, `/api/openapi.json`, `/.well-known/mcp/server-card.json`, `/mcp` answering 401 with
  where to sign in; the CLI from source against it (`--site http://localhost:5199`), including
  exit code 5 for a run that isn't there and `--cursor` paging.
- `vp run mcp:check -- --site http://localhost:5199`, signed in as a local account (its sign-in
  link, then the allow page, done with curl as the browser would): the tools, their output
  schemas, every read-only command identical on MCP, the API and the CLI, `runs` paged with
  `next`, `show` against its resource, and `trace` (the CLI signed in through `/device` the same
  way; locally the app has no Cloudflare log token, so both say it isn't set up, now compared
  without the CLI's "Failed (503): "). All checks passed. Each call's log line came out in the dev
  server's log (command, surface, client, user, time, failure).
- Not run: anything that spends tests (`test`, `run`, `remap`), here or on the deployed app.

## Still open

- ~~Deploy and check on the Mac~~: done 2026-11-21. `vp run deploy` went through first time
  (migrations up to date, staged, live), then `coverage:check` and `mcp:check` passed against the
  live site, 3/3: the tools with their output schemas, every read-only command identical on MCP,
  the API and the CLI (runs paged with limit and cursor too), `show` against its resource, `trace`
  with the fetch's real log; `limits` differing only in each request's own address counts. By
  hand on the live site: every page and docs page 200, missing ones 404, `/api/openapi.json`
  (OpenAPI 3.1, the eight routes), the server card, failures in the app's words (404 for a run
  that isn't there, 400 naming the field), the CLI's help, paging and exit code 5. Signed out,
  the three spending routes refuse an empty body with 400 (Void's validator runs first, as before
  the rewrite) and a valid one with 401 (`call` asks `requireAuth` before running), so no test
  can be spent signed out; not sent with a valid body, so nothing was spent.
- **Agents added before this change** were registered without the `tests` scope and can't step
  up: remove and add them again once (docs/agents.md says so).
- **MCP Apps** (the map or coverage page shown in the AI's chat): its own plan.
- **Publishing `void-commands`** to npm, once void-fbtee's events app uses it too and it's proven
  in two apps; then it's the evidence for proposing it to Void.
