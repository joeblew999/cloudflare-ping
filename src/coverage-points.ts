// The coverage answer's places as points on the world map (src/WorldMap.tsx), by level (plan
// 2026-11-21-03): a country's probe cities, or, for the world and a continent, a dot per country
// whose area is its probes. Then every data centre the airport data placed, on top. One way to
// draw them, for the Coverage page (pages/coverage.tsx) and the coverage map's MCP App
// (src/apps/coverage.tsx).
import type { CoverageAnswer } from "./commands/coverage-answer";
import type { WorldPoint } from "./WorldMap";

const some = (count: number, one: string, more: string) =>
  `${count.toLocaleString("en-US")} ${count === 1 ? one : more}`;

// A country's circle: its size by the square root of its probes, so its area follows them (from
// 1 probe to the United States' 1,115: on a world map 1,100 pixels wide, about 2.5 to 22 across).
// It may grow to 3% of the map's width.
const radiusOf = (probes: number) => 0.6 + 0.2 * Math.sqrt(probes);

export function coveragePoints({
  place,
  continents,
  cities,
  datacentres,
}: Pick<CoverageAnswer, "place" | "continents" | "cities" | "datacentres">): Array<WorldPoint> {
  const probes =
    place?.kind === "country"
      ? cities.map((each) => ({
          key: `${each.country}|${each.state ?? ""}|${each.city}`,
          lat: each.lat,
          lon: each.lon,
          className: "probe",
          r: 0.6,
          title: `${each.city}, ${each.state ? `${each.state}, ` : ""}${each.country}: ${some(each.probes, "probe", "probes")}`,
        }))
      : continents
          .flatMap((continent) => continent.countries)
          .flatMap((each) =>
            each.probes === 0 || each.lat === null || each.lon === null
              ? []
              : [
                  {
                    key: each.code,
                    lat: each.lat,
                    lon: each.lon,
                    className: "country",
                    r: radiusOf(each.probes),
                    most: 0.03,
                    title: `${each.name}: ${some(each.probes, "probe", "probes")} in ${some(each.cities, "city", "cities")}`,
                  },
                ],
          );
  return [
    ...probes,
    ...datacentres.flatMap((each) =>
      each.lat === null || each.lon === null
        ? []
        : [
            {
              key: each.code,
              lat: each.lat,
              lon: each.lon,
              className: "dc",
              r: 1.3,
              title: `${each.code}: ${each.name}`,
            },
          ],
    ),
  ];
}

// The probes' dots, for the map's key: a country's cities, or the countries.
export const probesKey = (place: CoverageAnswer["place"]) =>
  place?.kind === "country"
    ? { className: "probe", words: "Probes, by city" }
    : { className: "country", words: "Probes, by country (the bigger, the more)" };
