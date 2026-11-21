// The geographical coverage map (plan 2026-11-20-03): every one of Cloudflare's data centres and
// every one of Globalping's probes, on a world map, complete: where the app can run, and where it
// can be reached from. None of our own test results (those are the geographical probe map, on
// the same drawing: src/WorldMap.tsx). The CLI's `coverage`; `GET /api/coverage`. Narrowed to one
// place, a continent or a country, with the place picker (`?place=Europe`, `?place=TH`), as the
// API, CLI and MCP tool are.
import { Link } from "@void/react";
import {
  coverageGaps,
  coverageHeadline,
  coverageUnmatched,
  count,
} from "@cloudflare-ping/shared/coverage";
import { PLACE_FIELDS, asArgument } from "@cloudflare-ping/shared/places";
import { useState } from "react";
import { routeUrl } from "void/routes";
import { PlacePicker } from "../src/PlacePicker";
import { CoverageMap } from "../src/CoverageMap";
import type { Props } from "./coverage.server";

export default function CoveragePage({
  place,
  unmatched,
  totals,
  continents,
  datacentres,
  cities,
  places,
}: Props) {
  // A country gets its own view; a continent, the every-country table of just its countries.
  const country = place?.kind === "country" ? place : null;
  const [wanted, setWanted] = useState(place?.value ?? "");
  // Another place by a link on this page (the table, "Everywhere"): the box says it, as when the
  // page is opened at it (React's "adjusting state when a prop changes").
  const [boxFor, setBoxFor] = useState(place?.value ?? "");
  if ((place?.value ?? "") !== boxFor) {
    setBoxFor(place?.value ?? "");
    setWanted(place?.value ?? "");
  }
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
        <PlacePicker
          label="A continent or a country"
          field={PLACE_FIELDS.coverage}
          places={places}
          name="place"
          value={wanted ? [wanted] : []}
          onChange={([next = ""]) => setWanted(next)}
          placeholder="Everywhere, unless you pick one"
        />
        <button type="submit" className="button alt">
          Show
        </button>
      </form>

      <CoverageMap answer={{ place, continents, cities, datacentres, totals }} />

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
