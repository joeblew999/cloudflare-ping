// The geographical coverage map (plan 2026-11-20-03): every one of Cloudflare's data centres and
// every one of Globalping's probes, on a world map, complete: where the app can run, and where it
// can be reached from. None of our own test results (those are the geographical probe map, on
// the same drawing: src/WorldMap.tsx). The CLI's `coverage`; `GET /api/coverage`. Narrowed to one
// place, a continent or a country, with the place picker (`?place=Europe`, `?place=TH`), as the
// API, CLI and MCP tool are.
import { Link, useRouter } from "@void/react";
import {
  coverageGaps,
  coverageHeadline,
  coverageUnmatched,
  count,
} from "@cloudflare-ping/shared/coverage";
import { asArgument } from "@cloudflare-ping/shared/places";
import { useState } from "react";
import { routeUrl } from "void/routes";
import { PlacePicker } from "../src/PlacePicker";
import { coveragePoints } from "../src/coverage-points";
import { WorldMap } from "../src/WorldMap";
import type { Props } from "./coverage.server";

export default function CoveragePage({
  place,
  unmatched,
  totals,
  continents,
  datacentres,
  cities,
}: Props) {
  const points = coveragePoints({ cities, datacentres });
  const router = useRouter();
  // A country gets its own view; a continent, the every-country table of just its countries.
  const country = place?.kind === "country" ? place : null;
  const [wanted, setWanted] = useState(place?.value ?? "");
  const shown = 8;
  return (
    <main className="content wide vp-doc">
      <h1>Coverage</h1>
      <p className="lead">
        {coverageHeadline({ place, totals })}{" "}
        {place ? (
          <Link href="/coverage">Everywhere</Link>
        ) : (
          "Everywhere the app can run, and everywhere it can be reached from."
        )}
      </p>

      {unmatched ? <p className="different">{coverageUnmatched(unmatched)}</p> : null}

      <form method="get" action="/coverage" className="form coverage-filter">
        <label>
          A continent or a country
          <PlacePicker
            name="place"
            value={wanted}
            onChange={setWanted}
            kinds={["continent", "country"]}
            unknown="Not a continent or a country with probes"
            onPick={(picked) => {
              void router.visit(routeUrl("/coverage", { query: { place: picked.magic } }));
            }}
          />
        </label>
        <button type="submit" className="button alt">
          Show
        </button>
      </form>

      <figure className="coverage">
        <WorldMap
          points={points}
          zoom={place !== null}
          label={`A world map of Cloudflare's ${totals.datacentres} data centres and ${count(totals.probes)} probes`}
        />
        <figcaption>
          <span className="key dc" /> Cloudflare data centres · <span className="key probe" />{" "}
          Probes
        </figcaption>
      </figure>

      <p>
        The same from a terminal:{" "}
        <code>cloudflare-ping coverage{place ? ` --place ${asArgument(place.value)}` : ""}</code>
      </p>

      {country ? (
        <div className="form-row">
          <section>
            <h2>Data centres</h2>
            {datacentres.length === 0 ? (
              <p>None in {country.name}: visitors there are served from another country&apos;s.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <tbody>
                    {datacentres.map((each) => (
                      <tr key={each.code}>
                        <td>{each.code}</td>
                        <td>{each.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section>
            <h2>Probes, by city</h2>
            {cities.length === 0 ? (
              <p>None in {country.name}: it can only be tested from a neighbour.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <tbody>
                    {cities.slice(0, shown).map((each) => (
                      <tr key={`${each.state ?? ""}|${each.city}`}>
                        <td>
                          {each.city}
                          {each.state ? `, ${each.state}` : ""}
                        </td>
                        <td>{count(each.probes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {cities.length > shown ? <p>And {cities.length - shown} more cities.</p> : null}
          </section>
        </div>
      ) : (
        <section>
          <h2>{place ? `Every country in ${place.name}` : "Every country"}</h2>
          <p>{coverageGaps({ place, totals })}</p>
          <div className="table-scroll">
            <table className="countries">
              <thead>
                <tr>
                  <th>Continent</th>
                  <th>Country</th>
                  <th>Data centres</th>
                  <th>Probes</th>
                </tr>
              </thead>
              {continents.map((continent) => (
                <tbody key={continent.code}>
                  {continent.countries.map((each, at) => (
                    <tr key={each.code}>
                      {at === 0 ? (
                        <th scope="rowgroup" rowSpan={continent.countries.length + 1}>
                          {continent.name}
                        </th>
                      ) : null}
                      <td>
                        <Link href={routeUrl("/coverage", { query: { place: each.code } })}>
                          {each.name}
                        </Link>
                      </td>
                      <td>
                        {each.datacentres === 0 ? (
                          <span className="gap">none</span>
                        ) : (
                          count(each.datacentres)
                        )}
                      </td>
                      <td>
                        {each.probes === 0 ? <span className="gap">none</span> : count(each.probes)}
                      </td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>All of {continent.name}</td>
                    <td>{count(continent.datacentres)}</td>
                    <td>{count(continent.probes)}</td>
                  </tr>
                </tbody>
              ))}
            </table>
          </div>
        </section>
      )}

      {totals.unplaced.length > 0 ? (
        <p>Not on the map yet, since their place isn&apos;t known: {totals.unplaced.join(", ")}.</p>
      ) : null}
    </main>
  );
}
