# 2026-11-19-01-cloudflare-ping.md: our own Globalping, run from Cloudflare's data centres

Status: 2026-11-19, approved; steps 1 to 5 proven; step 6 built and deployed. Built on Void 1.10.0 (the user's call, 2026-11-19:
1.11.0 was hours old, and a release is installed a day after it comes out), with Vite+ held at
1.6.0, since Void 1.10.0 writes a Vite+ range that takes 1.7.0, whose core it doesn't match.
Changed the same day (the user's call): the app's own API is the one way in, for the CLI and the
pages alike, behind Void's auth (How we use it; step 6).

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

One way in: the app's own API (`routes/api/…`, on the deployed Worker). The CLI and the app's web
pages are both thin callers of it, so everything the app does lives in one place, the Worker.

- **The CLI:** commands run with `vp`, the same on the Mac, in CI and in a Claude session. Each is
  a short script in `scripts/` that calls the API with Void's typed fetch (`fetch` from
  `void/client`, `baseURL` set to the deployed app), so its paths, inputs and answers are checked
  against the routes.
  - `vp run ping:map` asks the app to build or refresh the map (`POST /api/map`).
  - `vp run ping:run -- --target <site> --where <all | region | codes>` asks the app to start a
    run (`POST /api/runs`). The app puts it on its own queue and does the work on Cloudflare, so it
    carries on if the machine stops. The command reads the results from the API as they arrive
    (`GET /api/runs/[id]`): a table by region, or JSON with `--json`.
- **The web pages:** the map and each run by region, each request linked to its trace, reading
  the same API.
- **Who may do what: Void's auth** (Better Auth, built into Void: `void/auth`, set up in
  `auth.ts`). Reading the map and the runs is open. Anything that spends Globalping tests
  (`POST /api/map`, `POST /api/runs`) calls `requireAuth(c)`, and answers 401 to anyone not signed
  in. On the web, sign-in is Void's own (`auth` from `void/client`). The CLI signs in once per
  machine with Better Auth's device login (it shows a code, the user approves it in the browser,
  it keeps the token). CI, with no one there to approve, uses a Better Auth API key kept as a CI
  secret. Void makes the auth secret on deploy; the auth tables are in the app's own D1, in its
  migrations (`void db generate`).
- void-fbtee's deploy job: `vp run ping:run -- --target <the example> --where all --json`, with
  its API key, then its global check reads that and the traces.
- While proving it (steps 1 to 5), before the API exists: `vp run probe:test -- --from <place>
  --path <path>` sends one Globalping test to the deployed probe and prints what came back (data
  centre, `cf-ray`, timings, the answer); `vp run probe:trace -- <ray id>` prints Cloudflare's
  trace of that request (`cf o11y telemetry query`). Since step 6, `probe:test` goes through the
  API too.

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
- **What has to be kept, from step 1:** Globalping says probes "don't expose unique IDs", and
  that measurements expire ("lifetime depends on user type"), so a reused measurement ID is the
  only handle on a probe, and only until it expires (Globalping's README and API spec, checked
  2026-11-19). So:
  - **each probe's newest measurement ID** is kept, and replaced each time the probe is used (a
    reuse makes a new measurement, with a new ID), so the handle never runs out while the probe is
    in use; when a probe goes offline, its data centre is found again from the place;
  - **each probe's own details** (country, city, network, ASN, position), since the ID won't say
    them once it has expired; and Cloudflare's own view of the same request (`cf.country`,
    `cf.city`, `cf.asn`), which can differ: Globalping's Pattani probe was Yala to Cloudflare;
  - **the evidence** for each step: its results, copied from Globalping into `evidence/` (step 1:
    `evidence/2026-11-19-step-1.json`, 8 measurements, 28 results), since the IDs named here will
    stop working.

  Until step 5 gives the app a database, these live in the repo; from step 7 the map lives in D1.

### 2. How much one Globalping test can carry

- Build: `/where` takes `?wait=<ms>` (answers after that long) and `?size=<bytes>` (that long an
  answer).
- Proof: the longest wait Globalping still gets an answer for, and how much of the answer it gives
  back, each found by a few tests. Together they say how many fetches fit in one test.
- If it's only a few seconds: the probe answers at once and does the work in `waitUntil`'s 30
  seconds, writing its results itself (step 5).
- **Result, 2026-11-19: 15 seconds and 10,000 bytes.** One probe from TH (Bangkok, AIS Fibre)
  each, sent by the app (`POST /api/probe`; Globalping takes the query string apart from the
  path, so `src/globalping.ts` splits it off):
  - wait 5 s and 10 s: answered (5,039 ms, 10,166 ms); 20, 30 and 60 s: "Request timed out
    while waiting for the first response byte", each at 15,000 ms.
  - Answering at once and finishing after the wait (a streamed answer, tried and then removed)
    doesn't buy more: at 20, 40 and 90 s, "Request timed out while downloading the response",
    again at 15,000 ms, and the part already sent is thrown away (0 bytes back). So 15 seconds
    is for the whole answer.
  - 5,000 and 10,000 bytes came back whole; 20,000, 100,000 and 1,000,000 came back as their
    first 10,000 bytes, marked `truncated`.
  - Even a test that timed out has the response's `cf-ray`, so it still says which data centre
    it reached.

  Copied into `evidence/2026-11-19-step-2.json` (13 measurements). **What that changes:** a test
  can carry what fits in about 12 seconds and a 10,000-byte answer: enough for step 3's single
  fetch, done inline. For runs of many fetches, the fallback above: `/run` answers at once and
  does the fetches in `waitUntil`'s 30 seconds, writing each result itself (step 5), so neither
  limit applies.

### 3. A fetch from our Worker runs the target in the same data centre

- Build: `routes/run.ts`: fetch one given address and answer its status, `cf-ray` and timings.
  Only targets on an allowed list (to start: void-fbtee's example). `probe:trace`.
- Proof: a Globalping test from Thailand to `/run` fetching the example's events page. The
  example's own trace for that request (it has tracing on) shows it ran in the same data centre
  as our Worker, and which D1 copy answered its reads.
- If the target runs elsewhere: our probes can't stand in for visitors there; the idea is dead.
- **Result, 2026-11-19: proven.** `routes/run.ts` fetches an address on the allowed list
  (`src/targets.ts`: void-fbtee's example only) and answers our data centre first, then the
  target's status, `cf-ray`, `x-isr-cache`, time and size (and the start of its answer when it
  isn't OK). `vp run probe:trace -- <ray id>` (`scripts/probe-trace.ts`) finds a request in the
  account's Workers logs by its ray ID, with Cloudflare's own CLI (`cf o11y telemetry query`;
  `cf` 1.0.0-beta.26, pinned in the project) and this machine's Cloudflare sign-in.
  - First, Cloudflare refused: our Worker fetching another Worker on `gedw99.workers.dev` got
    `error code: 1042`. The `global_fetch_strictly_public` compatibility flag (`void.config.ts`)
    sends `/run`'s fetches out as any visitor's would; it reached every data centre about 20
    seconds after the deploy.
  - Globalping, through the app (`POST /api/probe`), to `/run` fetching the example's
    `/en-US/events`: from TH (2SlQ1cc1o5Nfd8Whj00021X2Q), Bangkok, Chon Buri and Phuket: our
    Worker `BKK`, the example's `cf-ray` `BKK`. From DE (2P8DT0j8mqJOTdNMA00021X2Q): Falkenstein
    `FRA`/`FRA`; Hetzner Nuremberg `CDG`/`CDG` (the probe that reached Paris in step 1, and the
    example followed it there); netcup Nuremberg `FRA`/`FRA`. And the example's own log for each
    of the six, found by its ray ID, says the same data centre, for a request from
    `Cloudflare, Inc.` (our Worker). In `evidence/2026-11-19-step-3.json`. The fetch took 300 to
    500 ms.
  - Not answered: which D1 copy answered the example's reads. All six were edge-cache hits
    (`x-isr-cache: HIT`), so no read reached D1; and the example records no trace spans (its
    traces are empty, so "it has tracing on" above was wrong). To know, the example needs tracing
    on (or to report D1's `served_by_region`), and a request that misses its cache: a change in
    void-fbtee, for when a run needs it.

### 4. That fetch warms that data centre

- Proof: straight after step 3, a second fetch of the same page through the same route is a cache
  hit (`x-isr-cache: HIT`), and so is a Globalping test from Thailand fetching the page directly.
- If it isn't: warming needs another way; checking still works.
- **Result, 2026-11-19: proven, with what "warm" means made exact.** Void's page cache
  (`@void/isr` 1.10.0) has two layers: each data centre's edge cache (`caches.default`) in front
  of one global store (Workers KV, the example's `ISR_CACHE`). Both answer `x-isr-cache: HIT`,
  so the header alone can't say whether our fetch warmed anything; the example's own log can (how
  long it ran, and its CPU). `/run` takes `&repeat=<n>`, and `POST /api/probe` a `host`, to
  fetch an allowed target directly, as a visitor would. From Falkenstein (Hetzner, reaching
  `FRA`):
  - Control, `/ar-EG/events` fetched directly twice: first `STALE`, the example ran 1,098 ms with
    146 ms CPU (served the stale copy and rendered a new one); then `HIT`, 37 ms and 3 ms.
  - Treatment, `/th-TH/events` fetched first by our `/run`: `STALE`, 406 ms and 52 ms CPU (the
    refresh, done for our fetch); then directly by a visitor: `HIT`, 37 ms and 2 ms.

  So our fetch took the slow request, and the visitor after it got the fast one, as a second
  visitor does. In `evidence/2026-11-19-step-4.json`. **What that changes:** a warm page stays
  warm only for the target's own cache time, and the example's pages were `STALE` again within
  minutes (`cache-control: public, max-age=0, must-revalidate`): warming is worth doing just
  before the traffic, after a deploy (which empties the cache), not hours ahead. The refreshed
  copy also goes into the global store, so other data centres get it from there: slower than
  their own edge cache, but without a render.

### 5. A probe can record its own results

- Build: the app's D1 database, one table of fetch results (in `db/schema/`); `/run` writes a row
  per fetch, with the run's ID.
- Proof: the row for a test is there, with the same `cf-ray` the test saw.
- If it can't: results come back through Globalping's answer, within step 2's limits.
- **Result, 2026-11-19: proven.** `db/schema.ts`: `runs` (a random, unguessable ID: `/run`
  records only into a run that exists, so a public `/run` can't be used to write into the
  database) and `fetches` (one row per fetch: our request's `cf-ray`, our data centre, which
  attempt, and the target's status, `cf-ray`, data centre, cache, time and size). The starter's
  `messages` table, empty, dropped (two migrations, so drizzle-kit had nothing to ask; Void wants
  `-- void:allow-destructive` on a `DROP`). `/run?run=<id>` records each fetch; with
  `&background=1` it answers at once and fetches in `waitUntil`.
  - One run (ad4c83d6-7a07-4d8f-be59-dbf4f635c565, made with `void db execute --remote`, since
    `POST /api/runs` is step 8). From TH, inline (29gRLfVI7Dj4ZFCt700021X2i): two probes, two
    rows. From DE, `background=1&repeat=3` (2wVzShZGUjksMNApM00021X2i): each probe's answer came
    back at once ("fetching": 3), and three rows each arrived within 0.4 seconds. Each of the
    eight rows has the `cf-ray` its test saw, and each test has its rows. In
    `evidence/2026-11-19-step-5.json`.
  - In the background runs, the first fetch took 270 to 322 ms and the next two 13 to 15 ms:
    step 4's warm edge cache, in our own records.
  - So a run of many fetches isn't held to step 2's 15 seconds and 10,000 bytes: the test only
    has to reach the data centre; `waitUntil` gives the fetches 30 seconds after the answer, and
    the rows carry the results.

### 6. The app's API is the one way in, behind Void's auth

- Build: Void's auth (`auth.ts`, with Better Auth's device login and API key plugins; its tables
  in the migrations), and one route, `POST /api/probe`: signed in only, it sends one Globalping
  test to `/where` from the place given, waits for it, and answers what came back, as
  `probe:test` does now. `probe:test` becomes a caller of it (`fetch` from `void/client`), signing
  in by device login first.
- Proof: not signed in, `POST /api/probe` answers 401. Signed in by device login, `vp run
  probe:test --from TH` gets the same answer through the API as step 1 got from the Mac: `BKK`,
  matching the `cf-ray`. An API key made for CI does the same.
- Also found here: whether Globalping's free tests, counted per IP address, last when the Worker
  sends them, since a Worker's requests leave from addresses Cloudflare shares with others. If
  not: a Globalping account's token (500 tests an hour), set with `void secret put`.
- If device login doesn't work under Void: API keys on the Mac too.
- **Result so far, 2026-11-19: built and deployed; not yet proven with an account on the
  deployed app.** Built ahead of steps 2 to 5 (the user's call: it needs only `/where`). Void's
  auth with Better Auth 1.7.25's `bearer` and `deviceAuthorization` plugins (`auth.ts`); accounts
  only for the addresses in `ALLOWED_EMAILS` (`env.ts`; unset, no one); `POST /api/probe`
  (`routes/api/probe.ts`, step 1's Globalping code moved into `src/globalping.ts`); the `/login`
  and `/device` pages; the CLI's sign-in, `scripts/sign-in.ts`. Better Auth 1.7 approves a code
  only once the signed-in page has claimed it (`GET /api/auth/device?user_code=`), so
  `pages/device.tsx` does that first.
  - Locally (`vp dev`): not signed in, `POST /api/probe` answered 401; an address not allowed
    couldn't make an account. `vp run probe:test -- --site http://localhost:5199 --from TH
    --probes 2` signed in by device login (approved as the allowed account), then answered through
    the API, Globalping measurement 2qV1nmSd0Zc6FKmOO00021X1t: Bangkok (AIS Fibre) `BKK` and Ubon
    Ratchathani (ADVANCED WIRELESS NETWORK COMPANY) `BKK`, each matching its `cf-ray`. Run again,
    it used the kept token, with no sign-in: 2buhLjRfqgzbWoTEQ00021X1u, Falkenstein (Hetzner)
    `FRA`. Copied into `evidence/2026-11-19-step-6.json`.
  - Deployed (`void deploy --platform cloudflare`; the first time from a new machine it needs
    `CLOUDFLARE_WORKERS_SUBDOMAIN=gedw99`; the auth tables' migration applied): not signed in,
    `POST /api/probe` answers 401; with `ALLOWED_EMAILS` not yet set, no one can make an account;
    `/device` sends a visitor who isn't signed in to `/login`.
  - Still to prove: on the deployed app, with the user's own account once `ALLOWED_EMAILS` is set,
    the same answer through the API; and whether Globalping's free limit holds when the deployed
    Worker sends the tests (locally they left from the Mac). Not built: the CI API key, since an
    API key plugin isn't among Better Auth 1.7.25's own; until then, CI can use a device-login
    token as `CLOUDFLARE_PING_TOKEN`.
  - For steps 2 to 5: `probe:test` now goes through the API, so a session without a browser shows
    its link and code, and the user approves it from any browser.

### 7. The map: which data centres we can reach, and what it costs

- Build: `POST /api/map` (signed in): the app walks Globalping's probe list
  (`api.globalping.io/v1/probes`, one free call; 5,582 probes in 124 countries on 2026-11-19)
  country by country on its queue, one `/where` test each, and stores, per probe (the measurement it was found in and its place there, with its country,
  city and network as reference), the data centres it reached and how often, with the dates. Cloudflare's own list of
  data centres (`www.cloudflarestatus.com/api/v2/components.json`, 348 on 2026-11-19) is stored
  beside it as reference. `GET /api/map` answers it; `vp run ping:map` calls both.
- Proof: how many data centres it reaches, for how many tests. Run again a day later: how many
  rows changed.
- If too few, or it changes too often: decide then whether it's still worth it.

### 8. A run across many data centres

- Build: `POST /api/runs` (signed in): the run goes on a Void queue, one message per data centre,
  each sending that one Globalping test; done when every data centre's rows are in, or a sweep
  marks those that never answered. `GET /api/runs/[id]` answers its rows; `vp run ping:run` calls
  both.
- Proof: one data centre first, then every mapped one; the run's rows, and its total tests.

### 9. Then, and only then

The pages for the map and the runs (reading the same API), `--json` for void-fbtee's deploy check,
and a cron that re-maps. Each gets its own step, written here once 8 has passed.
