// The coverage map with its key: the coverage answer on the world map, by country, or a country's
// by city (src/coverage-points.ts). One figure for the Coverage page (pages/coverage.tsx) and the
// coverage map's MCP App (src/apps/coverage.tsx), so the two can't differ.
import { count } from "@cloudflare-ping/shared/coverage";
import type { CoverageAnswer } from "./commands/coverage-answer";
import { coveragePoints, probesKey } from "./coverage-points";
import { WorldMap } from "./WorldMap";

export function CoverageMap({
  answer,
}: {
  answer: Pick<CoverageAnswer, "place" | "continents" | "cities" | "datacentres" | "totals">;
}) {
  const probes = probesKey(answer.place);
  return (
    <figure className="coverage">
      <WorldMap
        points={coveragePoints(answer)}
        zoom={answer.place !== null}
        label={`A world map of Cloudflare's ${answer.totals.datacentres} data centres and ${count(answer.totals.probes)} probes`}
      />
      <figcaption>
        <span className="key dc" /> Cloudflare data centres ·{" "}
        <span className={`key ${probes.className}`} /> {probes.words}
      </figcaption>
    </figure>
  );
}
