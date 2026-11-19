# 2026-11-19-01-cloudflare-ping.md: our own Globalping, run from Cloudflare's data centres

Status: 2026-11-19, written; waits for the user's approval in the conversation. Built with Void
1.11.0, from 2026-11-20 01:48 UTC (a release is installed a day after it comes out).

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

## How it's built: one proof at a time

Each step proves one thing, with the least built to prove it. A step's result, with its date and
its evidence, is written into it here before the next starts. If a step fails, we stop and decide
again: nothing after it is built on a guess.

### 1. A Worker can tell us which data centre it's in

- Build: `void init` on Void 1.11.0, one route, `routes/where.ts`, answering `request.cf.colo`.
  Deployed.
- Proof: one Globalping HTTP test to `/where` from a probe in Thailand answers a data centre code,
  and the same code is the end of that response's `cf-ray`.
- If it fails: no probe can know where it is; the idea is dead.

### 2. How much one Globalping test can carry

- Build: `/where` takes `?wait=<ms>` (answers after that long) and `?size=<bytes>` (that long an
  answer).
- Proof: the longest wait Globalping still gets an answer for, and how much of the answer it gives
  back, each found by a few tests. Together they say how many fetches fit in one test.
- If it's only a few seconds: the probe answers at once and does the work in `waitUntil`'s 30
  seconds, writing its results itself (step 5).

### 3. A fetch from our Worker runs the target in the same data centre

- Build: `routes/run.ts`: fetch one given address and answer its status, `cf-ray` and timings.
  Only targets on an allowed list (to start: void-fbtee's example).
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
  and stores data centre → probe (country, city, network) with the date. Cloudflare's own list of
  data centres (`www.cloudflarestatus.com/api/v2/components.json`, 348 on 2026-11-19) is stored
  beside it as reference.
- Proof: how many data centres it reaches, for how many tests. Run again a day later: how many
  rows changed.
- If too few, or it changes too often: decide then whether it's still worth it.

### 7. A run across many data centres

- Build: `ping:run --target <site> --where <codes>`: through a Void queue, one message per data
  centre, each sending that one Globalping test; done when every data centre's rows are in, or a
  sweep marks those that never answered.
- Proof: one data centre first, then every mapped one; the run's rows, and its total tests.

### 8. Then, and only then

The sign-in on starting runs, pages for the map and the runs, the API for void-fbtee's deploy
check, and a cron that re-maps. Each gets its own step, written here once 7 has passed.
