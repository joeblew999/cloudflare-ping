# cloudflare-ping

Our own Globalping, run from Cloudflare's own data centres: a Globalping test is only the way into
a data centre, and our Worker there does the fetching. Built with [Void](https://void.cloud). How
and why, step by step: `.claude/plans/2026-11-19-01-cloudflare-ping.md`.

Deployed at https://cloudflare-ping.gedw99.workers.dev (Cloudflare account `7384af54e33b8a54ff240371ea368440`).

## What you can do, on the web and from a terminal

One way in: the app's own API (`routes/api/`). Each thing the app does is one API route; its web
page and its command both call that route with Void's typed fetch (`void/client`), and page
loaders and API routes share the same server code (`src/`). So the web and the terminal do the
same things, the same way.

| What                       | Web page               | In the repo                      | Anywhere (the package)           | API                                   |
| -------------------------- | ---------------------- | -------------------------------- | -------------------------------- | ------------------------------------- |
| Sign in                    | `/login`               | `vp run ping:sign-in`            | `cloudflare-ping sign-in`        | Void's auth (`/api/auth/…`)           |
| Sign out                   | "Sign out"             | `vp run ping:sign-out`           | `cloudflare-ping sign-out`       | Void's auth                           |
| Who's signed in            | the top bar            | `vp run ping:whoami`             | `cloudflare-ping whoami`         | Void's auth                           |
| One Globalping test        | `/`, "Run a probe"     | `vp run probe:test -- --from TH` | `cloudflare-ping test --from TH` | `POST /api/probe` (signed in)         |
| Start a run and follow it  | `/runs`, "Start a run" | `vp run ping:run -- --from TH`   | `cloudflare-ping run --from TH`  | `POST /api/runs` (signed in)          |
| The newest runs            | `/runs`                | `vp run ping:runs`               | `cloudflare-ping runs`           | `GET /api/runs`                       |
| One run and its fetches    | `/runs/<id>`           | `vp run ping:show -- <id>`       | `cloudflare-ping show <id>`      | `GET /api/runs/<id>`                  |
| A request's Cloudflare log | `/trace/<ray id>`      | `vp run probe:trace -- <ray id>` | `cloudflare-ping trace <ray id>` | `GET /api/trace/<ray id>` (signed in) |

`cloudflare-ping help` lists every option. Every command also takes `--json` (the API's answer as
it is) and `--site <url>` (another copy of the app, such as `vp dev`'s); `vp run cli -- <command>`
runs any of them from source. Each page shows its command. Signing in is also automatic: the first
command that needs it shows a link and a code to approve at `/device`.

### The CLI, as a package

The commands are in `cli/` (`cli/main.ts`, one file per command in `cli/commands/`, what they
share in `cli/api.ts`). In the repo, the `vp run` tasks (`vite.config.ts`) run them from source.
As the `cloudflare-ping` npm package (`cli/package.json`, `cli/README.md`), `vp run cli:pack`
builds them into one file, `cli/dist/main.mjs` (about 275 kB; every dependency is inside it, so
installing it installs nothing else), and `vp run cli:try -- <command>` runs that file.

It isn't published: `cli/package.json` says `"private": true`, which npm refuses to publish (only
`npm publish --dry-run` skips that check). To publish: remove that line, `vp run cli:pack`, then
`npm publish` in `cli/`. After that, `npx cloudflare-ping <command>` works on any machine with
Node 22 or later.

The CLI says which version of the API it was built for (`src/version.ts`), and the app refuses a
CLI built for another one, telling it to update (`middleware/02.api-version.ts`). Raise
`API_VERSION` when an API route changes in a way an older CLI can't use, and publish a new
version of the package with it.

A run sends one Globalping test, from probes in a place, to `/run` for that run; `/run` fetches
the target from each data centre the probes reach and records every fetch. Reading runs is open;
starting one, or reading Cloudflare's logs, needs you signed in.

## How it's built

- `routes/where.ts`: answers which Cloudflare data centre it ran in (`/where`). What Globalping's
  probes fetch. `?wait=<ms>` answers after that long and `?size=<bytes>` pads the answer, which
  found Globalping's limits: 15 seconds and 10,000 bytes per test (plan step 2).
- `routes/run.ts`: `/run?url=<address>` fetches an address from the data centre it ran in and
  answers what the target said (status, `cf-ray`, cache, time); `&repeat=<n>` fetches it n times
  in a row. Only the addresses in `src/targets.ts`. `&run=<id>` records each fetch in the
  database (`db/schema.ts`: `runs`, `fetches`), only for a run that exists; `&background=1`
  answers at once and fetches afterwards. Public, since Globalping's probes can't sign in. Needs
  `global_fetch_strictly_public` (`void.config.ts`) to reach other Workers on `gedw99.workers.dev`.
- `src/globalping.ts`, `src/runs.ts`, `src/trace.ts`: what the API routes and the pages' loaders
  both use. `src/trace.ts` reads the account's Workers logs with the app's own Cloudflare API
  token (`CLOUDFLARE_OBSERVABILITY_TOKEN`, "Workers Observability Read"); without it, the log
  lookups say they're not set up.
- `pages/layout.tsx`: every page's frame and links; `middleware/01.auth.ts` shares who's signed
  in.
- Signing in: `auth.ts` (Void's auth, with Better Auth's device login and bearer plugins). Only
  the addresses in the `ALLOWED_EMAILS` secret can make an account (`env.ts`). The first time a
  command needs it, it shows a link and a code (`cli/sign-in.ts`); open it, sign in
  (`/login`), approve the code (`/device`), and the command keeps its token in
  `~/.config/cloudflare-ping/tokens.json`. In CI, set `CLOUDFLARE_PING_TOKEN` instead.
- `evidence/`: each step's raw results, copied from Globalping before its measurements expire.
- `lint/void-rules.ts`: Void's own lint rules; `vite.config.ts` adds ours (no casts, no `any`, no `!`).

`vp check` formats, lints and type-checks. Deploy with
`void deploy --platform cloudflare`; the first time from a new machine, with
`CLOUDFLARE_WORKERS_SUBDOMAIN=gedw99`.

If a deploy stops with "the active Worker Version is not the latest upload" (or "could not verify
which Worker Version would supply inherited secrets"), an earlier deploy uploaded a version and
stopped before making it active, and Void (1.10.0) refuses every deploy after it; retrying only
adds more. Make the newest upload active, then deploy again:

```sh
pnpm exec cf workers versions list --worker-id cloudflare-ping --per-page 3   # newest first
pnpm exec cf workers deployments create --worker cloudflare-ping \
  --body '{"strategy":"percentage","versions":[{"version_id":"<newest id>","percentage":100}]}'
```
