# 2026-11-19-01-cloudflare-ping.md: our own Globalping, run from Cloudflare's data centres

Status: 2026-11-19, approved; step 1 proven. Built on Void 1.10.0 (the user's call, 2026-11-19:
1.11.0 was hours old, and a release is installed a day after it comes out), with Vite+ held at
1.6.0, since Void 1.10.0 writes a Vite+ range that takes 1.7.0, whose core it doesn't match.

## The idea

Globalping counts tests: 250 an hour without an account, shared with everyone on the same IP
address; 500 with one (globalping.io/credits, checked 2026-11-19). One test fetches one page from
one place. Instead, a Globalping test is only the way into a Cloudflare data centre: it lands on
our Worker there, and our Worker fetches every page we ask for, from there, in that one request.
What we remember is which Globalping probe lands in which data centre (the map). Our Worker keeps
nothing: a plain Worker lives only as long as its request (Cloudflare's Workers limits, checked
2026-11-19), and no Durable Objects are used.

The first user is void-fbtee's example app: after each deploy, warm every data centre and check,
region by region, that it behaves as designed (`void-fbtee/plans/read-latency.md`).

## How we use it

Through commands run with `vp`, the same on the Mac, in CI and in a Claude session, each using
the Cloudflare sign-in that machine already has (in CI, the token it already deploys with). The
app has no sign-in or key of its own.

- While proving it (steps 1 to 5): `vp run probe:test -- --from <place> --path <path>` sends one
  Globalping test to the deployed probe and prints what came back (data centre, `cf-ray`, timings,
  the answer); `vp run probe:trace -- <ray id>` prints Cloudflare's trace of that request
  (`cf o11y telemetry query`).
- Once it works (steps 6 and 7): `vp run ping:map` builds or refreshes the map; `vp run ping:run --
  --target <site> --where <all | region | codes>` puts the run on the app's queue (Cloudflare's
  Queues API, with the machine's sign-in), so the app does the work on Cloudflare and it carries on
  if the machine stops, then reads the results from the app's database as they arrive: a table by
  region, or JSON with `--json`.
- To look around: the app's own pages, the map and each run by region, each request linked to its
  trace. Read-only, so no sign-in.
- void-fbtee's deploy job: `vp run ping:run -- --target <the example> --where all --json`, then its
  global check reads that and the traces.

## How it's built: one proof at a time

Each step proves one thing, with the least built to prove it. A step's result, with its date and
its evidence, is written into it here before the next starts. If a step fails, we stop and decide
again: nothing after it is built on a guess.

### 1. A Worker can tell us which data centre it's in

- Build: `void init` on Void 1.11.0, one route, `routes/where.ts`, answering `request.cf.colo`.
  Deployed. `probe:test`.
- Proof: one Globalping HTTP test to `/where` from a probe in Thailand answers a data centre code,
  and the same code is the end of that response's `cf-ray`.
- If it fails: no probe can know where it is; the idea is dead.
- **Result, 2026-11-19: proven.** Deployed as https://cloudflare-ping.gedw99.workers.dev
  (`void deploy --platform cloudflare`, Void 1.10.0). `vp run probe:test --from TH --probes 3`,
  Globalping measurement 2cJRvCt2HmjAL4aV500021X0s:
  - Bangkok (AIS Fibre, AS133481): answer `BKK`, `cf-ray a5cd99551e42ee29-BKK`;
  - Pattani (ADVANCED WIRELESS NETWORK COMPANY, AS138524): answer `BKK`, `cf-ray ...-BKK`;
  - Phuket (same network): answer `BKK`, `cf-ray ...-BKK`.

  And from Germany (two probes, both Hetzner, AS24940): Falkenstein answered `FRA` (`cf-ray
  ...-FRA`), Nuremberg answered `CDG` (`cf-ray ...-CDG`): the same network, a city apart, reached
  Paris rather than Frankfurt. The answer and the `cf-ray` agreed every time. And it shows the map
  is needed: which data centre a probe reaches isn't where it is.

- **Found by step 1, checked the same day: does the same probe go back to the same data centre?**
  Globalping sends a test from exactly the probes of an earlier measurement when its ID is given as
  the location, so a probe can be chosen again. Reused three times, the three Thai probes went to
  `BKK` every time (measurements 251SNuhfewnCNvuGc00021X0v, 24UmIuDrwDoulM6OE00021X0v,
  2DDQdJQJ9YNemSvb400021X0v). Four German probes, reused three times (2euZuj8SKQSD9O0RN00021X0v,
  then 2O2j3d4BTZJdUSruW00021X0w, 2129MqsbU6dYWToEM00021X0w, 2fgMbUoQwEpabBsC300021X0w): Hetzner
  Falkenstein `FRA` 4 of 4, Hetzner Nuremberg `CDG` 4 of 4, Oracle Frankfurt `FRA` 4 of 4, netcup
  Nuremberg `HAM` once then `FRA` 3 times.
- **What that changes:** the map is keyed by the probe itself (the measurement it was found in, and
  its place in that measurement's results), not by country, city and network, which can't tell two
  probes on one network apart. And a probe mostly, but not always, goes back to the same data
  centre. That's not fatal, because every probe's answer says where it actually ran (this step):
  a run records each result under the data centre it really reached, and a data centre that
  wasn't reached is tried again with another probe the map has for it. The map keeps, per probe,
  how often it reached each data centre, so the steadiest probe is tried first.

### 2. How much one Globalping test can carry

- Build: `/where` takes `?wait=<ms>` (answers after that long) and `?size=<bytes>` (that long an
  answer).
- Proof: the longest wait Globalping still gets an answer for, and how much of the answer it gives
  back, each found by a few tests. Together they say how many fetches fit in one test.
- If it's only a few seconds: the probe answers at once and does the work in `waitUntil`'s 30
  seconds, writing its results itself (step 5).

### 3. A fetch from our Worker runs the target in the same data centre

- Build: `routes/run.ts`: fetch one given address and answer its status, `cf-ray` and timings.
  Only targets on an allowed list (to start: void-fbtee's example). `probe:trace`.
- Proof: a Globalping test from Thailand to `/run` fetching the example's events page. The
  example's own trace for that request (it has tracing on) shows it ran in the same data centre
  as our Worker, and which D1 copy answered its reads.
- If the target runs elsewhere: our probes can't stand in for visitors there; the idea is dead.

### 4. That fetch warms that data centre

- Proof: straight after step 3, a second fetch of the same page through the same route is a cache
  hit (`x-isr-cache: HIT`), and so is a Globalping test from Thailand fetching the page directly.
- If it isn't: warming needs another way; checking still works.

### 5. A probe can record its own results

- Build: the app's D1 database, one table of fetch results (in `db/schema/`); `/run` writes a row
  per fetch, with the run's ID.
- Proof: the row for a test is there, with the same `cf-ray` the test saw.
- If it can't: results come back through Globalping's answer, within step 2's limits.

### 6. The map: which data centres we can reach, and what it costs

- Build: a command that walks Globalping's probe list (`api.globalping.io/v1/probes`, one free
  call; 5,582 probes in 124 countries on 2026-11-19) country by country, one `/where` test each,
  and stores, per probe (the measurement it was found in and its place there, with its country,
  city and network as reference), the data centres it reached and how often, with the dates. Cloudflare's own list of
  data centres (`www.cloudflarestatus.com/api/v2/components.json`, 348 on 2026-11-19) is stored
  beside it as reference.
- Proof: how many data centres it reaches, for how many tests. Run again a day later: how many
  rows changed.
- If too few, or it changes too often: decide then whether it's still worth it.

### 7. A run across many data centres

- Build: `ping:run`: the run goes on a Void queue, one message per data centre, each sending that
  one Globalping test; done when every data centre's rows are in, or a sweep marks those that
  never answered.
- Proof: one data centre first, then every mapped one; the run's rows, and its total tests.

### 8. Then, and only then

The pages for the map and the runs, `--json` for void-fbtee's deploy check, and a cron that
re-maps. Each gets its own step, written here once 7 has passed.
