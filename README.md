# cloudflare-ping

Our own Globalping, run from Cloudflare's own data centres: a Globalping test is only the way into
a data centre, and our Worker there does the fetching. Built with [Void](https://void.cloud). How
and why, step by step: `.claude/plans/2026-11-19-01-cloudflare-ping.md`.

Deployed at https://cloudflare-ping.gedw99.workers.dev (Cloudflare account `7384af54e33b8a54ff240371ea368440`).

- `routes/where.ts`: answers which Cloudflare data centre it ran in (`/where`).
- `scripts/probe-test.ts`: one Globalping test to the deployed probe, and what came back
  (`vp run probe:test --from <place>`).
- `evidence/`: each step's raw results, copied from Globalping before its measurements expire.
- `lint/void-rules.ts`: Void's own lint rules; `vite.config.ts` adds ours (no casts, no `any`, no `!`).

The tasks are in `vite.config.ts`. `vp check` formats, lints and type-checks.
