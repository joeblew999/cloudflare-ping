// The coverage answer's places as points on the world map (src/WorldMap.tsx): every probe city,
// then every data centre the airport data placed, on top. One way to draw them, for the Coverage
// page (pages/coverage.tsx) and the coverage map's MCP App (src/apps/coverage.tsx).
import type { CoverageAnswer } from "./commands/coverage-answer";
import type { WorldPoint } from "./WorldMap";

export function coveragePoints({
  cities,
  datacentres,
}: Pick<CoverageAnswer, "cities" | "datacentres">): Array<WorldPoint> {
  return [
    ...cities.map((each) => ({
      key: `${each.country}|${each.state ?? ""}|${each.city}`,
      lat: each.lat,
      lon: each.lon,
      className: "probe",
      r: 0.6,
      title: `${each.city}, ${each.state ? `${each.state}, ` : ""}${each.country}: ${each.probes} ${each.probes === 1 ? "probe" : "probes"}`,
    })),
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
