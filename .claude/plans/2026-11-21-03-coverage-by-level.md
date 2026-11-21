# Coverage by level: countries for the world, cities for a country

Status: 2026-11-21, proposed. The user: "We've obviously built the coverage map badly."

## Why

The world's coverage answer carries every probe city's position: 141,000 of its 194,000
characters, and twice that over MCP (423,850 measured in `mcp:host`), nearly three times Claude's
limit of about 150,000. At world scale the 1,101 city dots pile up (Europe is a blur) and say less
than one dot per country would. The answer was doing two jobs, something to read and something to
draw; at the right level of detail one answer does both, small enough for everything.

The page and the CLI already list cities only for one country (pages/coverage.tsx,
packages/cli/commands/coverage.ts). For the world and a continent, cities were only ever drawn.

## The answer

- The world, or a continent: the totals, the table (every country by continent), the data centres,
  and each country's position, the middle of its probe cities, weighted by their probes (a country
  with data centres but no probes: the middle of its data centres). No city list.
- A country: as now, with all its probe cities.
- The middle is a circular mean of longitude, so a country across the date line (Fiji) isn't put in
  the middle of the world. From the data the app already has: nothing hard-coded.

## One option, not two

`cities` goes, everywhere: the API's `?cities=`, the CLI's `--cities` / `--no-cities`, the MCP
tool's `cities`, the page's own use. `place` is the only option. The level of detail follows from
it. (No one relies on the old shape: the user has said not to keep it for compatibility.) The page
cache's query allowlist follows the options' keys, so it follows too.

This reverses "cities unless `cities: false`" (plan 2026-11-20-04), on the user's word.

## The map

- The world or a continent: a dot per country, its area by its probes, and the data centres on top,
  as now. Hovering a country's dot says its probes and cities.
- A country: its cities, as now.
- The same in the coverage map's MCP App, which no longer has to ask for cities a continent at a
  time: that code goes.

## Kept small, for good

`mcp:check` checks that every answer it asks for is under Claude's limit (150,000 characters over
MCP). A deploy then fails before an answer grows too big for Claude, rather than after.

## Proof

- `vp test`: the circular middle (Fiji), weights, a country with only data centres.
- `mcp:check` after the deploy: identical answers on MCP, the API and the CLI, every answer under
  the limit, with the world's size measured.
- `mcp:host`: the world map with country dots, Europe, and a country with its cities, screenshots.
- The Coverage page and the CLI, by hand.
