# 2026-11-20-03-geographical-maps.md: the geographical coverage map and the geographical probe map

Status: 2026-11-20, written from the user's own words. Steps 0 to 3 built; the coverage map
is complete reference data, and reach moved to the probe map (step 4). Briefly held for usefulness, then taken
back up (the user: "if people go to the website … if they don't know the coverage, they have no
idea if this thing really works. The whole point is showing them … we've got the whole of
Cloudflare covered"). The coverage map is the app's proof to visitors that it works.

- **The proof is completeness.** The headline is "All 345 of Cloudflare's data centres, and
  Globalping's 5,600 probes in 124 countries": every one of each, on one world map. That's
  everywhere the app can run, and everywhere it can be reached from.
- **None of our own test results on it** (the user, 2026-11-20: "this was meant to show all of
  the Cloudflare data centers and the global pings completely … two different things probably
  using some of the same code"). Which data centres our probes reached, and where they ran,
  belong to the geographical probe map. Both maps draw with the same component
  (`src/WorldMap.tsx`).
- **It needs no tests and no token,** so it's right on the deployed site from the first visit.
- **Where visitors land:** `/coverage`, in the bar beside the map.

Names are the user's:

- **The geographical coverage map**: everything there is. All of Cloudflare's data centres and
  all of Globalping's probes on a world map, from their own lists.
- **The geographical probe map**: what our tests found, and the app at work in real time.
  Which data centres our map runs reached, and, while a run or a map goes, each probe's request
  drawn from its city to the data centre it landed in.

"The map" on its own stays the main plan's step 7: the table of which data centre each place
reaches, found by tests.

## The data: three sources, two of them live

|     | Source                                                                       | Gives                                                                                   | Kind                                      |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | Globalping's probe list (`api.globalping.io/v1/probes`)                      | every probe's place, network and coordinates: 5,597 on 2026-11-20, all with coordinates | live, one free call                       |
| 2   | Cloudflare's status page (`www.cloudflarestatus.com/api/v2/components.json`) | every data centre's code and place: 345 on 2026-11-20                                   | live, one free call                       |
| 3   | OurAirports (public domain)                                                  | coordinates for each data centre code (Cloudflare's codes are airport codes)            | static: a small file, made by a repo task |

How they relate:

- **2 and 3 join by the data centre's code.** Cloudflare says BKK is "Bangkok, Thailand", and
  the coordinates file says where BKK is.
- **1 stands alone.** Each probe has its own coordinates; nothing public says which data centre
  a probe uses.
- **The only link between probes and data centres is what our tests find out:** the map's
  sightings (main plan, step 7) and runs. Its data centre code joins back to 2.

So the coverage map needs no tests. What our tests find is the probe map's.

Things to know about source 2 (found 2026-11-20):

- Its list also holds services that carry a code in brackets: Data Loss Prevention (DLP),
  Cloud Network Interconnect (CNI) and Digital Experience Monitoring (DEX). A data centre is
  named "Place - (CODE)", which tells them apart.
- Some have no country in the name: Hong Kong, Taipei, Macau, Kaohsiung, Ramallah.
- Cloudflare keeps a data centre's code when its airport closes or renames. Berlin's is still
  TXL, years after Tegel closed in 2020.

## Everything at runtime, held only in Void's caches

The account is on Workers Paid (checked 2026-11-20: recent requests use up to 48 ms of CPU), so
reading big lists at runtime is fine. There's no dev-time step and no generated file. Each
source is fetched by the Worker and reduced to what the map needs. The result is kept in Void's
caching layers:

| Source                                               | Reduced to                                                     | Kept in                                             |
| ---------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------- |
| Globalping's probe list (2.3 MB, 267 KB compressed)  | ~1,100 cities: country, city, coordinates, probes              | KV (`void/kv`), re-checked every 5 minutes          |
| Cloudflare's data centre list (177 KB)               | ~345 data centres: code, place, region ("Place - (CODE)" only) | KV, re-checked every hour                           |
| OurAirports' `airports.csv` (12.7 MB, public domain) | the ~345 codes' coordinates and two-letter country             | KV, until a new code needs it (airports don't move) |

- **KV, the data layer, serves everyone,** signed in or not, since Void's page cache skips any
  request with a cookie.
- **ISR (`export const revalidate`) caches `/coverage` and `GET /api/coverage` whole** for
  five minutes for visitors who aren't signed in, refreshing in the background. Nothing purges
  them: a change in a list shows within those five minutes.
- **The world outline is a static asset** in `apps/web/public`: a picture, like the icon, not
  data.
- **The client router (`cacheFor`)** reuses pages already loaded.
- **The cold case:** the first read after a cache expires waits for its source; the airport
  file is the slowest, about a second, read only when a new code needs it. A map's start warms
  all three. If a source
  is down and its cache is empty, the page says what's missing rather than drawing it wrong.

### When each cache is refreshed

- **Globalping's probe list: by what our tests see, then by time** (the user, 2026-11-20:
  "when it runs, if you get a different answer, that tells you the cache has been
  invalidated").
  - Every test answers with each probe's place. A probe in a place the cached list doesn't
    have, or "no probe there" for a place it does, means the list has changed, so it's read
    again at once. Map runs and runs everywhere correct it where the app is used, for free.
  - Places no test touches give no signal, so the cached list is also re-checked every 5 minutes.
  - A probe landing in a different data centre than the map said is a change to our map, not
    to Globalping's list. Acting on that is "runs feed the map", held in the main plan.
- **Cloudflare's data centre list: by what our tests see, then by time.** Every test answers
  with the data centre our Worker ran in (`/where`'s colo, or the end of its `cf-ray`). A code the
  cached list doesn't have means Cloudflare has opened a data centre, so the list is read again
  at once. Otherwise it is re-checked every hour, since Cloudflare doesn't announce new ones.
- **The airport places: by the data, and only that.** A code in Cloudflare's list that the
  cached airport places don't cover is read again from the airport file at once. No time limit:
  airports don't move, and new codes only come through Cloudflare's list (the user,
  2026-11-20, asked why time was needed).
- **Why the other two keep a time limit:** tests only see places we test. They never show a
  probe going offline, or a data centre closing, where no test goes. Nor do they show a new data
  centre no probe lands in. Without time, the coverage page could show what no longer exists,
  or miss what's new, for weeks: the wrong thing for a page that proves coverage. A re-check every 5 minutes
  for Globalping and every hour for Cloudflare costs a 304 each, almost nothing.
- **So one test can refresh all three, in a chain:** a probe lands in an unknown data centre;
  Cloudflare's list is re-read, and has it; the airport places don't cover it, so the airport
  file is re-read and places it; the coverage page shows it within its five minutes.
- **Our code: by version.** KV outlives deploys, so each key carries a version
  (`coverage:v2:probe-cities`, since cities carry a US state), bumped when what's kept changes shape. What's read back is
  checked against its schema (zod), and anything that doesn't fit is fetched again.

### Re-checking is asking "changed?", and comparing

(The user, 2026-11-20: "validation would just be that if it was different, from a previous
run".) Each re-read is compared with what's cached, and the sources do the comparing for us:

- Both lists come with a version tag (`ETag`; checked 2026-11-20). Asked again with
  `If-None-Match`, Globalping answered **304 Not Modified**: a few bytes, not 2.3 MB.
  Cloudflare's 304 is checked at the build.
- The tag is kept beside each cached list.
  - **304:** the cache is still right. Nothing is downloaded, parsed or cleared.
  - **200:** it changed. The new list replaces the cache.
- A re-check costs almost nothing, so "by time" becomes asking every few minutes, not reading
  every hour.
- It's only about caching: what changed isn't logged or kept (the user, 2026-11-20).

### Testing the refresh rules

Each rule is a test (`vp test`). Void's KV is swapped for an in-memory map, as Void's own
`guide/testing.md` does, and `fetch` and the clock are replaced:

- **Cached:** two reads, one fetch.
- **Re-checks:** past the interval, the next read asks with the cached tag. A 304 keeps the
  cache; a 200 replaces it.
- **A test sees a new place:** a test result with a city the cache doesn't have re-reads the
  probe list.
- **The chain:** a result in an unknown data centre code re-reads Cloudflare's list, then the
  airport file, in that order.
- **Airports have no time limit:** a year later, no new code, no re-read.
- **Our code changed:** an old-shaped value under an old key is ignored and fetched fresh.

Then under `vp dev`: the logs show one fetch, then cache hits, then a re-read after an unknown
code.

## Placing data centres

- Cloudflare's codes are airport codes, so a data centre's place is its airport's coordinates,
  read at runtime from OurAirports (above). On 2026-11-20 that placed 340 of the 345.
- Five codes aren't in the airport data. They're placed in code, from Cloudflare's own names:

  | Code | Cloudflare's name   |
  | ---- | ------------------- |
  | TXL  | Berlin, Germany     |
  | KIV  | Chișinău, Moldova   |
  | FRU  | Bishkek, Kyrgyzstan |
  | QWJ  | Americana, Brazil   |
  | JXG  | Jiaxing, China      |

- A new code the airport data can't place is logged, and drawn as unplaced on the page, so it
  can join those five.
- Each data centre keeps its airport's two-letter country code (the five get theirs in code).
  Globalping names a probe's country the same way ("TH"), while Cloudflare writes it out
  ("Thailand", or not at all: "Hong Kong"). So probes and data centres line up by country with
  no name-matching, which the by-country and by-region summaries need.
- Not solved, on purpose:
  - City names: Globalping's and Cloudflare's don't always match, and the map works from
    coordinates.
  - The airport's position against the data centre's own building: an airport can be tens of
    kilometres out (Narita is about 60 km from Tokyo), which a world map can't show.

## Built on what the map already has

Two pieces of `apps/web/src/map.ts` (main plan, step 7) read the same two live lists:

- `placesFor()` fetches Globalping's probe list and groups it by country or city.
- `refreshDatacentres()` fetches Cloudflare's list and picks out the real data centres (the
  " - (CODE)" rule).

Each is lifted into its own module, used by both the map and the coverage map:

- Globalping's probe list: read, checked, grouped by city with coordinates and probe count, and
  re-checked every 5 minutes.
- Cloudflare's data centre list: read, checked, the real ones only.

So the reading, the checking and the fixes live in one place.

## Build order, each proved before the next

0. **The two lists lifted out of `src/map.ts`, cached in KV, with the refresh rules and their
   tests** (above). Proof: the map works as before (a
   local map by country and by city), and its tests pass.
1. **Placing data centres at runtime.** OurAirports read and reduced, kept until a new code needs it, plus the
   five in code. Proof: 345 placed, BKK at Bangkok, TXL at Berlin; a second read comes from the
   cache.
2. **`coverage`, everywhere but the page.**
   - The command, `GET /api/coverage`, the CLI and the MCP tool.
   - Proof: its counts match the two live lists (345 data centres; probe cities as Globalping
     has them that day); `--json` and the API give the same.
3. **The page `/coverage`.** Proof: in the browser, every data centre and probe city is a dot
   in the right place (BKK on Bangkok, the probes in Japan on Japan), in light and dark, and at
   phone width.
4. **The probe map**, on the same drawing (`src/WorldMap.tsx`).
   - The data centres the newest map run reached, coloured; the rest grey. Proof: after a map
     run, its reached data centres are the coloured ones, and the CLI and API agree.
   - Each fetch and each sighting on the live stream carries the probe's place.
   - A run's page and a map run's page draw the lines as they arrive, and the CLI follows them.
   - Proof: a background run's lines appear as its fetches do, one landing elsewhere drawn
     differently.

## Open, for the build

- Which Natural Earth file, and how small it can be while countries stay recognisable.
- The projection: equirectangular is simplest; a rounder one looks better but costs code.
- How the page draws about 1,100 probe cities without being slow, especially at phone width.
