# cloudflare-ping

Our own Globalping, run from Cloudflare's own data centres: a Globalping test is only the way into
a data centre, and our Worker there does the fetching. Built with [Void](https://void.cloud). How
and why, step by step: `.claude/plans/2026-11-19-01-cloudflare-ping.md`.

Deployed at https://cloudflare-ping.gedw99.workers.dev (Cloudflare account `7384af54e33b8a54ff240371ea368440`),
with its docs at https://cloudflare-ping.gedw99.workers.dev/docs/ (`apps/docs`, VitePress).

## What you can do, on the web and from a terminal

<!-- The docs show this section as it is (apps/docs/guide.md); write it here only. -->
<!-- #region use -->

One way in: the app's own API (`apps/web/routes/api/`). Each thing the app does is one API route;
its web page and its command both call that route with Void's typed fetch (`void/client`), and
page loaders and API routes share the same server code (`apps/web/src/`). So the web and the
terminal do the same things, the same way.

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

A run sends one Globalping test, from probes in a place, to `/run` for that run; `/run` fetches
the target from each data centre the probes reach and records every fetch. Reading runs is open;
starting one, or reading Cloudflare's logs, needs you signed in.

<!-- #endregion use -->

### The CLI, as a package

<!-- #region package -->

The commands are in `packages/cli` (`main.ts`, one file per command in `commands/`, what they
share in `api.ts`; their names and help, with the docs, in `packages/shared/src/commands.ts`). In
the repo, the `vp run` tasks (the root `vite.config.ts`) run them from source. As the
`cloudflare-ping` npm package (`packages/cli/package.json`, `packages/cli/README.md`),
`vp run cli:pack` (`vp pack`, configured in `packages/cli/vite.config.ts`) builds them into one
file, `packages/cli/dist/main.mjs` (about 275 kB; every dependency is inside it, so installing it
installs nothing else), and `vp run cli:try -- <command>` runs that file.

It isn't published: `packages/cli/package.json` says `"private": true`, which npm refuses to
publish (only `npm publish --dry-run` skips that check). To publish: remove that line,
`vp run cli:pack`, then `npm publish` in `packages/cli`. After that, `npx cloudflare-ping <command>`
works on any machine with Node 22 or later.

The CLI says which version of the API it was built for (`packages/shared/src/version.ts`), and the
app refuses a CLI built for another one, telling it to update
(`apps/web/middleware/02.api-version.ts`). Raise `API_VERSION` when an API route changes in a way
an older CLI can't use, and publish a new version of the package with it.

<!-- #endregion package -->

## The repo

A Vite+ monorepo, as Vite+'s `vite:monorepo` template and its monorepo guide lay one out:

| Where             | Package                   | What                                                                                           |
| ----------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| `apps/web`        | `web`                     | The Void app: its pages, API routes, database, auth, and the Worker (`void.config.ts`)         |
| `apps/docs`       | `docs`                    | The docs (VitePress 2), built into `apps/web/public/docs` for the app to serve at `/docs/`     |
| `packages/cli`    | `cloudflare-ping`         | The CLI, and the npm package it becomes (`vp pack`)                                            |
| `packages/shared` | `@cloudflare-ping/shared` | What those three share: where the app is, what `/run` may fetch, the API version, the commands |
| `packages/theme`  | `@cloudflare-ping/theme`  | One look for the app and the docs: VitePress's own theme CSS, in Void's colours                |

- `pnpm-workspace.yaml`: the packages, and one version of each shared dependency for all of them
  (the catalog: Vite+, Void, VitePress, …; `"catalog:"` in each package.json).
- The root `vite.config.ts`: lint and format for the whole repo, the pre-commit check (`staged`,
  set up by `vp config` on install), the repo's tasks (`vp run <task>` from anywhere in it), and
  `defaultPackage`, so plain `vp dev` and `vp build` at the root mean the app and `vp pack` the CLI.
  With options (`vp dev --port 5199`), name the app: `vp -C apps/web dev --port 5199`.
- Each package's own `vite.config.ts`: what it builds. The app's `build` task runs after its
  workspace dependencies' (the docs: `dependsOn`), so the docs are always built first.
- The CLI and the docs call the app's API with Void's typed fetch, so their tsconfigs extend the
  app's generated `apps/web/.void/tsconfig.json` (the app's route types).
- At the root too: `.claude/plans/` (the plan), `evidence/` (each step's raw results, copied from
  Globalping before its measurements expire), `lint/void-rules.ts` (Void's own lint rules; the
  root config adds ours: no casts, no `any`, no `!`).

## How the app is built

In `apps/web`:

- `routes/where.ts`: answers which Cloudflare data centre it ran in (`/where`). What Globalping's
  probes fetch. `?wait=<ms>` answers after that long and `?size=<bytes>` pads the answer, which
  found Globalping's limits: 15 seconds and 10,000 bytes per test (plan step 2).
- `routes/run.ts`: `/run?url=<address>` fetches an address from the data centre it ran in and
  answers what the target said (status, `cf-ray`, cache, time); `&repeat=<n>` fetches it n times
  in a row. Only the addresses in `packages/shared/src/targets.ts`. `&run=<id>` records each fetch
  in the database (`db/schema.ts`: `runs`, `fetches`), only for a run that exists;
  `&background=1` answers at once and fetches afterwards. Public, since Globalping's probes can't
  sign in. Needs `global_fetch_strictly_public` (`void.config.ts`) to reach other Workers on
  `gedw99.workers.dev`.
- `src/globalping.ts`, `src/runs.ts`, `src/trace.ts`: what the API routes and the pages' loaders
  both use. `src/trace.ts` reads the account's Workers logs with the app's own Cloudflare API
  token (`CLOUDFLARE_OBSERVABILITY_TOKEN`, "Workers Observability Read"); without it, the log
  lookups say they're not set up.
- `pages/layout.tsx`: every page's frame and links, as the docs' bar, with light or dark;
  `middleware/01.auth.ts` shares who's signed in and where the page is; `middleware/00.head.ts`
  sets light or dark before the page paints, as VitePress does and under its key
  (`src/appearance.ts`), so a choice in the docs holds in the app.
- The look: the docs'. `pages/style.css` starts from VitePress's own theme CSS (`packages/theme`:
  its fonts, variables, base and `.vp-doc` styles, in Void's colours, which the docs use too) and
  styles the app's bar, buttons, hero and cards as VitePress styles its own (VPNavBar, VPButton,
  VPHero, VPFeature), with the same values.
- Signing in: `auth.ts` (Void's auth, with Better Auth's device login and bearer plugins). Only
  the addresses in the `ALLOWED_EMAILS` secret can make an account (`env.ts`). The first time a
  command needs it, it shows a link and a code (`packages/cli/sign-in.ts`); open it, sign in
  (`/login`), approve the code (`/device`), and the command keeps its token in
  `~/.config/cloudflare-ping/tokens.json`. In CI, set `CLOUDFLARE_PING_TOKEN` instead.

## The docs

`apps/docs` is the docs site (VitePress 2), served by the app at `/docs/`: `vp run docs:dev` to
write them (VitePress's own server), `vp run docs:build` to build them into
`apps/web/public/docs` (ignored by git), where `vp dev` and the deployed app serve them. Building
the app builds them first (its `build` task depends on them), so `void deploy` ships them too: one
deploy, one site.

They're written once, from the sources: the guide includes this README's sections (the
`#region` comments), the command reference is the CLI's own list
(`packages/shared/src/commands.ts`, read by `apps/docs/cli.data.ts`), the plan page includes the
plan, and the home page's newest runs come live from the app's API (`GET /api/runs`, with
`void/client`, as the Runs page and `cloudflare-ping runs` do). The theme is VitePress's, in
Void's colours (`apps/docs/.vitepress/theme`, with `packages/theme/brand.css`).

The docs are their own package, and the app's package doesn't depend on VitePress (the app takes
VitePress's CSS through `packages/theme`): Void 1.10.0,
deploying to Cloudflare, takes a package that depends on VitePress for a static VitePress site and
refuses to deploy it while it has `routes/` and `pages/`, even with `inference.appType: "void"`
(only its own platform's path reads that setting): worth reporting to Void.

## Building and deploying

From the root: `vp check` formats, lints and type-checks every package; `vp run -r build` builds
every package, each after the ones it depends on; `pnpm ready` does both. `vp run deploy` deploys
the app and its docs (`void deploy --platform cloudflare` in `apps/web`, which builds both first);
the first time from a new machine, with `CLOUDFLARE_WORKERS_SUBDOMAIN=gedw99`. Void's other
commands (`void db …`, `void secret …`) run in `apps/web`.

Locally: `vp dev` at the root runs the app, with the docs at `/docs/` once built. `vp preview`
runs the production build, which needs `BETTER_AUTH_SECRET` (Void: `guide/auth.md`): put one in
`apps/web/.env` (ignored by git; any long random value, such as
`node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`).

Every Vite+ command and task was run from the root on 2026-11-19, and each did what it says:
`vp check`, `vp lint`, `vp fmt --check`, `vp hooks status`, `vp run -r build`, `vp build`,
`vp pack`, `pnpm ready`, `vp dev`, `vp -C apps/web dev --port 5199`, `pnpm dev`, `vp preview`,
`vp install`, and the tasks `cli`, `probe:test`, `probe:trace`, `ping:run`, `ping:runs`,
`ping:show`, `ping:whoami`, `ping:sign-out`, `cli:pack`, `cli:try`, `docs:dev`, `docs:build`,
`docs:preview` and `deploy`.

If a deploy stops with "did not pass /\_\_void/ready", Void put the previous version back and left
the new one inactive; this happened once when deploying straight after another deploy. The next
deploy will then stop as below.

If a deploy stops with "the active Worker Version is not the latest upload" (or "could not verify
which Worker Version would supply inherited secrets"), an earlier deploy uploaded a version and
stopped before making it active, and Void (1.10.0) refuses every deploy after it; retrying only
adds more. Make the newest upload active (and check `/__void/ready` answers 200), then deploy
again:

```sh
pnpm exec cf workers versions list --worker-id cloudflare-ping --per-page 3   # newest first
pnpm exec cf workers deployments create --worker cloudflare-ping \
  --body '{"strategy":"percentage","versions":[{"version_id":"<newest id>","percentage":100}]}'
```
