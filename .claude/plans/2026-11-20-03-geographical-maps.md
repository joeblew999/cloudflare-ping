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

## What's made at dev time, what's fetched, what's kept

|     | What                             | When                                                                             | How it's held                                                                                                                                                                                                     |
| --- | -------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Data centre coordinates          | dev time: `vp run datacentres:places`, re-run when Cloudflare opens data centres | a JSON file in `packages/shared` (~10 KB), bundled into the Worker                                                                                                                                                |
| 2   | The world outline                | dev time: a task run once (coastlines don't change)                              | an SVG path already projected, in `apps/web/public` (tens of KB)                                                                                                                                                  |
| 3   | Globalping's probe list          | live                                                                             | 2.3 MB of JSON (267 KB compressed, 2026-11-20): too much to read on every view, given about 10 ms of CPU a request on Workers Free. Reduced to its ~1,100 cities (tens of KB) and cached for an hour (Void's ISR) |
| 4   | Cloudflare's data centre list    | live                                                                             | 177 KB; cached the same way. The map already copies it into `datacentres` at each map's start                                                                                                                     |
| 5   | Which data centres we've reached | as map runs happen                                                               | the map's `sightings` (D1), as now                                                                                                                                                                                |

Coordinates become positions on the picture in the browser, by the same projection the outline
was drawn with. Nothing else is held.

## The data centre coordinates file

- A repo task, `vp run datacentres:places`, reads source 2 and the OurAirports dataset (12 MB,
  read only by the task, never by the app). It writes `packages/shared/src/datacentre-places.json`
  (code → latitude, longitude; about 345 entries, about 10 KB). The file is committed, so a re-run's
  diff shows which data centres Cloudflare added, renamed or dropped.
- Five codes aren't in the airport data. They're placed by hand, in the script, from
  Cloudflare's own names:

  | Code | Cloudflare's name   |
  | ---- | ------------------- |
  | TXL  | Berlin, Germany     |
  | KIV  | Chișinău, Moldova   |
  | FRU  | Bishkek, Kyrgyzstan |
  | QWJ  | Americana, Brazil   |
  | JXG  | Jiaxing, China      |

- The task names any new code it can't place, so it can go in the hand-placed list.

## Everywhere, as every command is

Written once (`src/commands/`), in the commands list, so `help`, the docs, the skill and the MCP
tools follow.

**`coverage`**: open, since it spends no tests.

| Where                          | What                                                                                                                                             |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Page `/coverage`               | the world map: data centre dots, probe dots by city (sized by probes), reached and not yet in different colours                                  |
| `GET /api/coverage`            | its data: each data centre (code, place, coordinates, reached by the newest map or not) and each probe city (country, city, coordinates, probes) |
| CLI `cloudflare-ping coverage` | a summary (data centres reached and not yet, by region; probes by country); `--json` gives the whole data                                        |
| MCP tool `coverage`            | the data, so an agent can answer "which data centres in Africa haven't we reached?"                                                              |

**The probe map**, which needs a run or a map going:

| Where                          | What                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A run's page, a map run's page | drawn live: a line from each probe's city to the data centre it landed in, as it lands; one that lands where the map didn't expect drawn differently |
| CLI (`run`, `remap`)           | follows it, printing each probe's line as it lands, as `run` follows its fetches                                                                     |
| API, MCP                       | a snapshot of where the probes landed so far, since a tool call is one request and one answer                                                        |

It uses the live stream `/run` already publishes each fetch to (`void/live`), with the probe's
place added. A map run publishes each sighting the same way.

## The world itself

A plain SVG with a public-domain world outline (Natural Earth's land, at a small scale), in the
app's own look and in light and dark. No map service, no tiles, no API key, and no request from
the visitor's browser to anyone but the app.

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

0. **The two lists lifted out of `src/map.ts`** (above). Proof: the map works as before (a
   local map by country and by city), and its tests pass.
1. **The coordinates file and its task.** Proof: about 345 codes placed, the five by hand, BKK
   at Bangkok; a second run makes no diff.
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
