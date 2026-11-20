// `coverage` (plan 2026-11-20-03): the geographical coverage map's data, complete. Every one of
// Cloudflare's data centres, placed, and every one of Globalping's probes, by city, from the
// cached lists (src/sources/lists.ts). None of our own test results: where our probes ran and
// what they reached is the geographical probe map, another thing on the same drawing. Open: it
// spends no tests. `GET /api/coverage`, the Coverage page, the CLI and the MCP tool.
//
// Narrowed to one country (plan 2026-11-20-04, "One filter, everywhere"): its data centres (by the
// country their airport is in) and its probe cities. Nothing given: everything.
import { z } from "zod";
import { searchPlaces } from "@cloudflare-ping/shared/places";
import {
  allPlaces,
  continents,
  countries as countryList,
  placedDatacentres,
  probes,
} from "../sources/lists";
import { coverageFilter } from "./coverage-filter";

export { coverageFilter };

export const coverageQuery = coverageFilter.extend({
  // With every probe city (about 1,100), not only the totals, regions and data centres.
  cities: z.boolean().optional(),
});

// The country asked for: its code as given, or the country the one place search finds for a name
// ("japan", "thialand"); none: null.
async function countryCode(asked: string): Promise<string | null> {
  if (/^[A-Za-z]{2}$/.test(asked)) {
    return asked.toUpperCase();
  }
  const [found] = searchPlaces(await allPlaces(), { q: asked, kinds: ["country"], limit: 1 });
  return found?.magic ?? null;
}

export async function coverage(options: z.infer<typeof coverageQuery> = {}) {
  const asked = options.country?.trim() ?? "";
  const code = asked === "" ? undefined : ((await countryCode(asked)) ?? undefined);
  const [
    {
      data: { cities: everyCity },
    },
    everyCentre,
  ] = await Promise.all([probes(), placedDatacentres()]);
  const cities = code ? everyCity.filter((each) => each.country === code) : everyCity;
  const all = code ? everyCentre.filter((each) => each.country === code) : everyCentre;
  // Every country with a data centre or a probe: its data centres and probes side by side,
  // grouped by continent. Names and continents from the countries list; a country it doesn't
  // know keeps its code, and the continent its probes are in.
  const codes = [
    ...new Set([
      ...all.flatMap((each) => (each.country ? [each.country] : [])),
      ...cities.map((each) => each.country),
    ]),
  ];
  const [known, continentNamed] = await Promise.all([
    countryList(codes),
    continents([...new Set(cities.map((each) => each.continent))]),
  ]);
  const probeContinent = new Map(cities.map((each) => [each.country, each.continent]));
  const countries = codes
    .map((each) => {
      const here = cities.filter((city) => city.country === each);
      const continent = known[each]?.continent ?? probeContinent.get(each) ?? "";
      return {
        code: each,
        name: known[each]?.name ?? each,
        continent,
        datacentres: all.filter((centre) => centre.country === each).length,
        probes: here.reduce((sum, city) => sum + city.probes, 0),
        cities: here.length,
      };
    })
    // A to Z, so a visitor finds their country.
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const byContinent = new Map<string, Array<(typeof countries)[number]>>();
  for (const each of countries) {
    byContinent.set(each.continent, [...(byContinent.get(each.continent) ?? []), each]);
  }
  const named = code ? known[code]?.name : undefined;
  return {
    // The country it's narrowed to, named from the same list the places are: null for everything.
    country: code ? { code, name: named ?? code } : null,
    // What was asked for when no country matched it: every country is shown instead.
    unmatched: asked !== "" && !code ? asked : null,
    totals: {
      datacentres: all.length,
      // Data centres the airport data couldn't place (a new code): not on the map yet.
      unplaced: all.filter((each) => each.lat === null).map((each) => each.code),
      probes: cities.reduce((sum, each) => sum + each.probes, 0),
      cities: cities.length,
      countries: new Set(cities.map((each) => each.country)).size,
      // How the two line up, country by country.
      bothCountries: countries.filter((each) => each.datacentres > 0 && each.probes > 0).length,
      noProbeCountries: countries.filter((each) => each.probes === 0).length,
      noDatacentreCountries: countries.filter((each) => each.datacentres === 0).length,
    },
    // Every country, its data centres and probes, grouped by continent; both A to Z.
    continents: [...byContinent]
      .map(([continent, members]) => ({
        code: continent,
        name: continentNamed[continent] ?? (continent || "Elsewhere"),
        datacentres: members.reduce((sum, each) => sum + each.datacentres, 0),
        probes: members.reduce((sum, each) => sum + each.probes, 0),
        countries: members,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "en")),
    datacentres: all,
    cities: options.cities === false ? [] : cities,
  };
}
