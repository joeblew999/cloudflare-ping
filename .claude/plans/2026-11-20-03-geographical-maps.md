# 2026-11-20-03-geographical-maps.md: the geographical coverage map and the geographical probe map

Status: 2026-11-20, written from the user's own words. Briefly held for usefulness, then taken
back up (the user: "if people go to the website … if they don't know the coverage, they have no
idea if this thing really works. The whole point is showing them … we've got the whole of
Cloudflare covered"). The coverage map is the app's proof to visitors that it works.

- **The proof is the reached layer.** The headline is "N of 345 Cloudflare data centres
  reached, from M places", with those lit and the rest grey. The free layers (all data
  centres, Globalping's probes) are only the background; on their own they show what exists,
  not what we reach.
- **It's honest.** Where no probe reaches a data centre (China's JXG is a likely one), the map
  says so.
- **Where visitors land:** the home page carries the coverage map, or one click to it, beside
  `/coverage`.
- **It needs a real map run on the deployed site to light up**, which needs the Globalping
  token. It can be built and checked locally before that, against a local map.

Names are the user's:

- **The geographical coverage map**: where we can reach. Cloudflare's data centres and
  Globalping's probes on a world map, and which data centres our map runs have reached.
- **The geographical probe map**: the app at work, in real time. While a run or a map goes,
  each probe's request is drawn from its city to the data centre it landed in.

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

So the coverage map needs no tests; only its "reached" colouring comes from our map runs.

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

| Source                                               | Reduced to                                                     | Kept in                          |
| ---------------------------------------------------- | -------------------------------------------------------------- | -------------------------------- |
| Globalping's probe list (2.3 MB, 267 KB compressed)  | ~1,100 cities: country, city, coordinates, probes              | KV (`void/kv`), an hour          |
| Cloudflare's data centre list (177 KB)               | ~345 data centres: code, place, region ("Place - (CODE)" only) | KV, a day                        |
| OurAirports' `airports.csv` (12.7 MB, public domain) | the ~345 codes' coordinates and two-letter country             | KV, a week (airports don't move) |
| Our map runs                                         | the data centres reached                                       | D1 (`sightings`), as now         |

- **KV, the data layer, serves everyone,** signed in or not, since Void's page cache skips any
  request with a cookie.
- **ISR (`export const revalidate`) caches `/coverage` and `GET /api/coverage` whole** for
  visitors who aren't signed in, refreshing in the background. When a map run finishes,
  `revalidate({ paths })` from `void/isr` purges them, so newly reached data centres show at
  once.
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
  - Places no test touches give no signal, so the cached list also expires in an hour.
  - A probe landing in a different data centre than the map said is a change to our map, not
    to Globalping's list. Acting on that is "runs feed the map", held in the main plan.
- **Cloudflare's data centre list: by what our tests see, then by time.** Every test answers
  with the data centre our Worker ran in (`/where`'s colo, or the end of its `cf-ray`). A code the
  cached list doesn't have means Cloudflare has opened a data centre, so the list is read again
  at once. Otherwise it expires in a day, since Cloudflare doesn't announce new ones.
- **The airport places: by the data, and only that.** A code in Cloudflare's list that the
  cached airport places don't cover is read again from the airport file at once. No time limit:
  airports don't move, and new codes only come through Cloudflare's list (the user,
  2026-11-20, asked why time was needed).
- **Why the other two keep a time limit:** tests only see places we test. They never show a
  probe going offline, or a data centre closing, where no test goes. Nor do they show a new data
  centre no probe lands in. Without time, the coverage page could show what no longer exists,
  or miss what's new, for weeks: the wrong thing for a page that proves coverage. An hour for
  Globalping and a day for Cloudflare cost one free call each.
- **So one test can refresh all three, in a chain:** a probe lands in an unknown data centre;
  Cloudflare's list is re-read, and has it; the airport places don't cover it, so the airport
  file is re-read and places it; the coverage page is cleared, and shows it.
- **Our data: by our own event.** A map run that finishes clears `/coverage` and
  `/api/coverage` from ISR (`revalidate({ paths })`), so its reach shows at once. Deploys clear
  ISR too, and a TTL backs it up for the lists the page also shows.
- **Our code: by version.** KV outlives deploys, so each key carries a version
  (`coverage:v1:probe-cities`), bumped when what's kept changes shape. What's read back is
  checked against its schema (zod), and anything that doesn't fit is fetched again.

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
  cached an hour.
- Cloudflare's data centre list: read, checked, the real ones only.

So the reading, the checking and the fixes live in one place.

## Build order, each proved before the next

0. **The two lists lifted out of `src/map.ts`, cached in KV** (above). Proof: the map works as before (a
   local map by country and by city), and its tests pass.
1. **Placing data centres at runtime.** OurAirports read and reduced, cached a week, plus the
   five in code. Proof: 345 placed, BKK at Bangkok, TXL at Berlin; a second read comes from the
   cache.
2. **`coverage`, everywhere but the page.**
   - The command, `GET /api/coverage`, the CLI and the MCP tool.
   - Proof: its counts match the two live lists (345 data centres; probe cities as Globalping
     has them that day); `--json` and the API give the same.
3. **The page `/coverage`.** Proof: in the browser, every data centre and probe city is a dot
   in the right place (BKK on Bangkok, the probes in Japan on Japan), in light and dark, and at
   phone width.
4. **Reached.** The newest map run's data centres are coloured. Proof: after a map run, its
   reached data centres are the coloured ones, and the CLI and API agree.
5. **The probe map.**
   - Each fetch and each sighting on the live stream carries the probe's place.
   - A run's page and a map run's page draw the lines as they arrive, and the CLI follows them.
   - Proof: a background run's lines appear as its fetches do, one landing elsewhere drawn
     differently.

## Open, for the build

- Which Natural Earth file, and how small it can be while countries stay recognisable.
- The projection: equirectangular is simplest; a rounder one looks better but costs code.
- Whether the coverage map should also count where runs' probes landed (the main plan held that
  for the map itself on 2026-11-20; it would follow the same decision).
- How the page draws about 1,100 probe cities without being slow, especially at phone width.
