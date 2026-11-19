# cloudflare-ping

Our own Globalping, run from Cloudflare's own data centres: a Globalping test is only the way into
a data centre, and our Worker there does the fetching. Built with [Void](https://void.cloud). How
and why, step by step: `.claude/plans/2026-11-19-01-cloudflare-ping.md`.

Deployed at https://cloudflare-ping.gedw99.workers.dev (Cloudflare account `7384af54e33b8a54ff240371ea368440`).

One way in: the app's own API. The CLI (`vp run …`) and the web pages both call it; anything
that spends Globalping tests needs you signed in (Void's auth).

- `routes/where.ts`: answers which Cloudflare data centre it ran in (`/where`). What Globalping's
  probes fetch. `?wait=<ms>` answers after that long and `?size=<bytes>` pads the answer, which
  found Globalping's limits: 15 seconds and 10,000 bytes per test (plan step 2).
- `routes/run.ts`: `/run?url=<address>` fetches an address from the data centre it ran in and
  answers what the target said (status, `cf-ray`, cache, time); `&repeat=<n>` fetches it n times
  in a row. Only the addresses in `src/targets.ts`. `&run=<id>` records each fetch in the
  database (`db/schema.ts`: `runs`, `fetches`), only for a run that exists; `&background=1`
  answers at once and fetches afterwards. Needs `global_fetch_strictly_public` (`void.config.ts`) to reach other
  Workers on `gedw99.workers.dev`.
- `scripts/probe-trace.ts`: `vp run probe:trace -- <ray id>` finds a request in the account's
  Workers logs (Cloudflare's `cf` CLI, with your Cloudflare sign-in): where it ran, from where,
  how long.
- `routes/api/probe.ts`: `POST /api/probe`, signed in only: the app sends one Globalping test to
  `/where` and answers what came back (`src/globalping.ts`).
- `scripts/probe-test.ts`: `vp run probe:test -- --from <place>` calls `POST /api/probe` and
  prints the answer. `--host <target>` tests an allowed target directly, as a visitor would.
- Signing in: `auth.ts` (Void's auth, with Better Auth's device login and bearer plugins). Only
  the addresses in the `ALLOWED_EMAILS` secret can make an account (`env.ts`). The first time a
  command needs it, it shows a link and a code (`scripts/sign-in.ts`); open it, sign in
  (`/login`), approve the code (`/device`), and the command keeps its token in
  `~/.config/cloudflare-ping/tokens.json`. In CI, set `CLOUDFLARE_PING_TOKEN` instead.
- `evidence/`: each step's raw results, copied from Globalping before its measurements expire.
- `lint/void-rules.ts`: Void's own lint rules; `vite.config.ts` adds ours (no casts, no `any`, no `!`).

The tasks are in `vite.config.ts`. `vp check` formats, lints and type-checks. Deploy with
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
