// `coverage` (plan 2026-11-20-03): the geographical coverage map's data, complete. Every one of
// Cloudflare's data centres, placed, and every one of Globalping's probes, by city, from the
// cached lists (src/sources/lists.ts). None of our own test results: where our probes ran and
// what they reached is the geographical probe map, another thing on the same drawing. Open: it
// spends no tests. `GET /api/coverage`, the Coverage page, the CLI and the MCP tool.
import { z } from "zod";
import { datacentres, places, probes } from "../sources/lists";

export const coverageQuery = z.object({
  // With every probe city (about 1,100), not only the totals, regions and data centres.
  cities: z.boolean().optional(),
});

export async function coverage(options: z.infer<typeof coverageQuery> = {}) {
  const [{ data: cities }, { data: centres }] = await Promise.all([probes(), datacentres()]);
  const placed = await places(centres.map((each) => each.code));
  const all = centres.map((each) => ({
    ...each,
    lat: placed[each.code]?.lat ?? null,
    lon: placed[each.code]?.lon ?? null,
    country: placed[each.code]?.country ?? null,
  }));
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
