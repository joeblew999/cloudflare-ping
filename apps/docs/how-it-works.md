# How it works

[Globalping](https://globalping.io) runs tests from thousands of probes around the world, and
counts them: 250 an hour without an account. A test normally fetches one page from one place.

cloudflare-ping uses a test only to get into a Cloudflare data centre. The probe requests our
Worker; Cloudflare runs it in the data centre that probe reaches; and from there our Worker
fetches what we ask, as often as we ask, and records it. What we keep is which probe reaches which
data centre.

## What each step proved

Each step proves one thing before the next is built on it. Every answer has its raw evidence,
copied from Globalping before its measurements expire, and from Cloudflare's own logs.

| Step | The question                                                         | The answer                                                                                                                                                                                                           | Evidence                                                                                          |
| ---- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1    | Can a Worker tell which data centre it's in?                         | Yes: `request.cf.colo`, and the same code ends the response's `cf-ray`. Thai probes reached `BKK`; two Hetzner probes a city apart reached `FRA` and `CDG`, so the map has to be by probe, not by place.             | [step 1](https://github.com/joeblew999/cloudflare-ping/blob/main/evidence/2026-11-19-step-1.json) |
| 2    | How much does one test carry?                                        | 15 seconds and 10,000 bytes. Longer waits time out (even when the answer starts at once), and longer answers are cut off; a timed-out test still has its `cf-ray`.                                                   | [step 2](https://github.com/joeblew999/cloudflare-ping/blob/main/evidence/2026-11-19-step-2.json) |
| 3    | Does a fetch from our Worker run the target in the same data centre? | Yes, six times out of six (`BKK` ×3, `FRA` ×2, `CDG`), by the target's `cf-ray` and its own logs. Reaching another Worker on `workers.dev` needs the `global_fetch_strictly_public` flag (otherwise error 1042).     | [step 3](https://github.com/joeblew999/cloudflare-ping/blob/main/evidence/2026-11-19-step-3.json) |
| 4    | Does that fetch warm the data centre?                                | Yes. A first visitor took the stale copy and its re-render (1,098 ms of work); with our fetch first, ours took it (406 ms) and the visitor got the cached page (37 ms). Warm lasts only the target's own cache time. | [step 4](https://github.com/joeblew999/cloudflare-ping/blob/main/evidence/2026-11-19-step-4.json) |
| 5    | Can the Worker record its own results?                               | Yes: in the background it answers at once and records every fetch in the app's database, so a run isn't held to step 2's limits.                                                                                     | [step 5](https://github.com/joeblew999/cloudflare-ping/blob/main/evidence/2026-11-19-step-5.json) |
| 6    | One way in                                                           | The app's own API, behind Void's auth: the web pages, the `vp run` tasks and the `cloudflare-ping` package all call the same routes.                                                                                 | [the commands](./cli)                                                                             |

## What's next

- **The map:** walk Globalping's probes, country by country, and keep which probe reaches which of
  Cloudflare's data centres, and how often.
- **Runs everywhere:** one run that reaches every mapped data centre, each through the steadiest
  probe the map has for it.

The whole plan, with every result as it was written: [The plan](./plan).
