// `coverage` (plan 2026-11-20-03): the geographical coverage map's data, complete. Every one of
// Cloudflare's data centres, placed, and every one of Globalping's probes, by city, from the
// cached lists (src/sources/lists.ts). None of our own test results: where our probes ran and
// what they reached is the geographical probe map, another thing on the same drawing. Open: it
// spends no tests. `GET /api/coverage`, the Coverage page, the CLI and the MCP tool.
//
// Narrowed to one country (plan 2026-11-20-04, "One filter, everywhere"): its data centres (by the
// country their airport is in) and its probe cities. Nothing given: everything.
import { z } from "zod";
import { countries as countryNames, placedDatacentres, probes } from "../sources/lists";

// The filter, the same for the page's address, the API's query, the CLI's `--country` and the MCP
// tool: a country's code, as the place picker gives it ("TH").
export const coverageFilter = z.object({
  country: z
    .string()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
});

export const coverageQuery = coverageFilter.extend({
  // With every probe city (about 1,100), not only the totals, regions and data centres.
  cities: z.boolean().optional(),
});

export async function coverage(options: z.infer<typeof coverageQuery> = {}) {
  const code = options.country?.toUpperCase();
  const [
    {
      data: { cities: everyCity },
    },
    everyCentre,
  ] = await Promise.all([probes(), placedDatacentres()]);
  const cities = code ? everyCity.filter((each) => each.country === code) : everyCity;
  const all = code ? everyCentre.filter((each) => each.country === code) : everyCentre;
  const named = code ? await countryNames([code]) : {};
  const regions = new Map<string, number>();
  for (const each of all) {
    const region = each.region ?? "Elsewhere";
    regions.set(region, (regions.get(region) ?? 0) + 1);
  }
  const countries = new Map<string, number>();
  for (const each of cities) {
    countries.set(each.country, (countries.get(each.country) ?? 0) + each.probes);
  }
  return {
    // The country it's narrowed to, named from the same list the places are: null for everything.
    country: code ? { code, name: named[code] ?? code } : null,
    totals: {
      datacentres: all.length,
      // Data centres the airport data couldn't place (a new code): not on the map yet.
      unplaced: all.filter((each) => each.lat === null).map((each) => each.code),
      probes: cities.reduce((sum, each) => sum + each.probes, 0),
      cities: cities.length,
      countries: countries.size,
    },
    // Cloudflare's data centres by its own regions.
    regions: [...regions]
      .map(([region, count]) => ({ region, datacentres: count }))
      .sort((a, b) => b.datacentres - a.datacentres),
    // Globalping's probes by country, the most first.
    probeCountries: [...countries]
      .map(([country, count]) => ({ country, probes: count }))
      .sort((a, b) => b.probes - a.probes),
    datacentres: all,
    cities: options.cities === false ? [] : cities,
  };
}
