# cloudflare-ping

Our own Globalping, run from Cloudflare's own data centres: a Globalping test is only the way into
a data centre, and our Worker there does the fetching. Built with [Void](https://void.cloud). How
and why, step by step: `.claude/plans/2026-11-19-01-cloudflare-ping.md`.

Deployed at https://cloudflare-ping.gedw99.workers.dev (Cloudflare account `7384af54e33b8a54ff240371ea368440`).

One way in: the app's own API. The CLI (`vp run …`) and the web pages both call it; anything
that spends Globalping tests needs you signed in (Void's auth).

- `routes/where.ts`: answers which Cloudflare data centre it ran in (`/where`). What Globalping's
  probes fetch.
- `routes/api/probe.ts`: `POST /api/probe`, signed in only: the app sends one Globalping test to
  `/where` and answers what came back (`src/globalping.ts`).
- `scripts/probe-test.ts`: `vp run probe:test -- --from <place>` calls `POST /api/probe` and
  prints the answer.
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
