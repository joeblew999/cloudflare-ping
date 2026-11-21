// `coverage` (plan 2026-11-20-03): the geographical coverage map's data, complete. Every one of
// Cloudflare's data centres, placed, and every one of Globalping's probes, by city, from the
// cached lists (src/sources/lists.ts). None of our own test results: where our probes ran and
// what they reached is the geographical probe map, another thing on the same drawing. Open: it
// spends no tests. `GET /api/coverage`, the Coverage page, the CLI and the MCP tool.
//
// Narrowed to one place (plan 2026-11-20-04, "One filter, everywhere"): a continent or a country,
// never both, so nothing combines or conflicts. Nothing given: everything.
import { coverage as definition } from "@cloudflare-ping/shared/commands";
import { searchPlaces } from "@cloudflare-ping/shared/places";
import {
  allPlaces,
  continents,
  countries as countryList,
  placedDatacentres,
  probes,
} from "../sources/lists";
import { continentRule } from "../sources/places";
import { middleOf } from "../middle";
import { implement } from "./context";
import { coverageAnswer, type Narrowed } from "./coverage-answer";

export const coverage = implement(definition, coverageAnswer, async (options) => {
  const [
    {
      data: { cities: everyCity },
    },
    everyCentre,
  ] = await Promise.all([probes(), placedDatacentres()]);

  // Every country with a data centre or a probe, its name from the countries list, and its continent
  // by the one rule (src/sources/places.ts, `continentRule`), as the places have it.
  const everyCode = [
    ...new Set([
      ...everyCentre.flatMap((each) => (each.country ? [each.country] : [])),
      ...everyCity.map((each) => each.country),
    ]),
  ];
  const known = await countryList(everyCode);
  const continentOf = continentRule(known, everyCity);
  const continentNamed = await continents([
    ...new Set(everyCode.map((each) => continentOf(each)).filter((each) => each !== "")),
  ]);

  // The place asked for: two letters are a country's code (continents go by name: "SA" is Saudi
  // Arabia, not South America); anything else, the continent or country the one place search finds
  // first ("europe", "japan", "thialand").
  const asked = options.place?.trim() ?? "";
  let place: Narrowed | null = null;
  if (/^[A-Za-z]{2}$/.test(asked)) {
    const code = asked.toUpperCase();
    place = everyCode.includes(code)
      ? { kind: "country", code, name: known[code]?.name ?? code, value: code }
      : null;
  } else if (asked !== "") {
    const [found] = searchPlaces(await allPlaces(), {
      q: asked,
      kinds: ["continent", "country"],
      limit: 1,
    });
    const code = found?.kind === "continent" ? found.codes[0] : found?.magic;
    if (found && code) {
      place = {
        kind: found.kind === "continent" ? "continent" : "country",
        code,
        name: found.name,
        // What's written to ask for it again: a continent by its name, a country by its code.
        value: found.kind === "continent" ? found.name : code,
      };
    }
  }
  const inPlace = (country: string | null) =>
    !place ||
    (place.kind === "country" ? country === place.code : continentOf(country) === place.code);
  const cities = everyCity.filter((each) => inPlace(each.country));
  const all = everyCentre.filter((each) => inPlace(each.country));

  // Every country in the place, its data centres and probes side by side, grouped by continent.
  const codes = everyCode.filter((each) => inPlace(each));
  const countries = codes
    .map((each) => {
      const here = cities.filter((city) => city.country === each);
      const centres = all.filter((centre) => centre.country === each);
      // Where it goes on the map: the middle of its probe cities, by their probes; of its data
      // centres when it has no probes.
      const middle =
        middleOf(here.map((city) => ({ lat: city.lat, lon: city.lon, weight: city.probes }))) ??
        middleOf(
          centres.flatMap((centre) =>
            centre.lat === null || centre.lon === null
              ? []
              : [{ lat: centre.lat, lon: centre.lon, weight: 1 }],
          ),
        );
      return {
        code: each,
        name: known[each]?.name ?? each,
        continent: continentOf(each),
        datacentres: centres.length,
        probes: here.reduce((sum, city) => sum + city.probes, 0),
        cities: here.length,
        lat: middle?.lat ?? null,
        lon: middle?.lon ?? null,
      };
    })
    // A to Z, so a visitor finds their country.
    .sort((a, b) => a.name.localeCompare(b.name, "en"));
  const byContinent = new Map<string, Array<(typeof countries)[number]>>();
  for (const each of countries) {
    byContinent.set(each.continent, [...(byContinent.get(each.continent) ?? []), each]);
  }
  return {
    // The place it's narrowed to, a continent or a country, named from the same lists the places
    // are: null for everything.
    place,
    // What was asked for when no place matched it: everything is shown instead.
    unmatched: asked !== "" && !place ? asked : null,
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
    // A country's probe cities, the most probes first. The world and a continent are drawn by
    // country (each country's place above), so they have none: plan 2026-11-21-03.
    cities: place?.kind === "country" ? [...cities].sort((a, b) => b.probes - a.probes) : [],
  };
});
