// What `coverage` answers (src/commands/coverage.ts), on its own: only zod and the sources'
// shapes, so the coverage map's MCP App (src/apps/coverage.tsx) checks the answer it's handed
// with the same schema the command answers with.
import { z } from "zod";
import { datacentre, probeCity } from "../sources/reduce";

// The place it's narrowed to, and how it's written to ask for it again (`value`: a country by its
// code, a continent by its name), for an address, a command or a box.
export const narrowed = z.object({
  kind: z.enum(["continent", "country"]),
  code: z.string(),
  name: z.string(),
  value: z.string(),
});
export type Narrowed = z.infer<typeof narrowed>;

// A country in the table: its data centres and probes side by side.
const country = z.object({
  code: z.string(),
  name: z.string(),
  continent: z.string(),
  datacentres: z.number(),
  probes: z.number(),
  cities: z.number(),
  // Where it goes on the map: the middle of its probe cities, by their probes (of its data
  // centres when it has none). Null when nothing in it is placed.
  lat: z.number().nullable(),
  lon: z.number().nullable(),
});

export const coverageAnswer = z.object({
  // The place it's narrowed to, a continent or a country, named from the same lists the places
  // are: null for everything.
  place: narrowed.nullable(),
  // What was asked for when no place matched it: everything is shown instead.
  unmatched: z.string().nullable(),
  totals: z.object({
    datacentres: z.number(),
    // Data centres the airport data couldn't place (a new code): not on the map yet.
    unplaced: z.array(z.string()),
    probes: z.number(),
    cities: z.number(),
    countries: z.number(),
    // How the two line up, country by country.
    bothCountries: z.number(),
    noProbeCountries: z.number(),
    noDatacentreCountries: z.number(),
  }),
  // Every country, its data centres and probes, grouped by continent; both A to Z.
  continents: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      datacentres: z.number(),
      probes: z.number(),
      countries: z.array(country),
    }),
  ),
  // Cloudflare's data centres, each placed by its airport code.
  datacentres: z.array(
    datacentre.extend({
      country: z.string().nullable(),
      lat: z.number().nullable(),
      lon: z.number().nullable(),
    }),
  ),
  // A country's probe cities, the most probes first; none for the world or a continent, which are
  // drawn by country.
  cities: z.array(probeCity),
});

export type CoverageAnswer = z.infer<typeof coverageAnswer>;
