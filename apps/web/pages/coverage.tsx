// The geographical coverage map (plan 2026-11-20-03): every one of Cloudflare's data centres and
// every one of Globalping's probes, on a world map, complete: where the app can run, and where it
// can be reached from. None of our own test results (those are the geographical probe map, on
// the same drawing: src/WorldMap.tsx). The CLI's `coverage`; `GET /api/coverage`. Narrowed to one
// country with the place picker (`?country=TH`), as the API, CLI and MCP tool are.
import { Link, useRouter } from "@void/react";
import { useState } from "react";
import { routeUrl } from "void/routes";
import { PlacePicker } from "../src/PlacePicker";
import { WorldMap, type WorldPoint } from "../src/WorldMap";
import type { Props } from "./coverage.server";

export default function CoveragePage({
  country,
  unmatched,
  totals,
  continents,
  datacentres,
  cities,
}: Props) {
  const points: Array<WorldPoint> = [
    ...cities.map((each) => ({
      key: `${each.country}|${each.state ?? ""}|${each.city}`,
      lat: each.lat,
      lon: each.lon,
      className: "probe",
      r: country ? 1 : 0.6,
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
              r: country ? 2 : 1.3,
              title: `${each.code}: ${each.name}`,
            },
          ],
    ),
  ];
  const router = useRouter();
  const [wanted, setWanted] = useState(country?.code ?? "");
  const shown = 8;
  // When narrowed to a country: its probe cities, the most probes first.
  const byCity = [...cities].sort((a, b) => b.probes - a.probes);
  // Thousands with commas, the same on the server and in the browser.
  const count = (n: number) => n.toLocaleString("en-US");
  return (
    <main className="content wide vp-doc">
      <h1>Coverage</h1>
      {country ? (
        <p className="lead">
          {country.name} ({country.code}): <strong>{totals.datacentres}</strong> of
          Cloudflare&apos;s data centres, and <strong>{count(totals.probes)}</strong> probes in{" "}
          {count(totals.cities)} {totals.cities === 1 ? "city" : "cities"}.{" "}
          <Link href="/coverage">Every country</Link>
        </p>
      ) : (
        <p className="lead">
          All <strong>{totals.datacentres}</strong> of Cloudflare&apos;s data centres, and{" "}
          <strong>{count(totals.probes)}</strong> probes in {count(totals.cities)} cities in{" "}
          {totals.countries} countries: everywhere the app can run, and everywhere it can be reached
          from.
        </p>
      )}

      {unmatched ? (
        <p className="different">
          No country with probes matches &ldquo;{unmatched}&rdquo;: here is every country.
        </p>
      ) : null}

      <form method="get" action="/coverage" className="form coverage-filter">
        <label>
          One country
          <PlacePicker
            name="country"
            value={wanted}
            onChange={setWanted}
            kinds={["country"]}
            unknown="Not one of the countries with probes"
            onPick={(place) => {
              void router.visit(routeUrl("/coverage", { query: { country: place.magic } }));
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
          label={`A world map of Cloudflare's ${totals.datacentres} data centres and ${count(totals.probes)} probes`}
        />
        <figcaption>
          <span className="key dc" /> Cloudflare data centres · <span className="key probe" />{" "}
          Probes
        </figcaption>
      </figure>

      <p>
        The same from a terminal:{" "}
        <code>cloudflare-ping coverage{country ? ` --country ${country.code}` : ""}</code>
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
            {byCity.length === 0 ? (
              <p>None in {country.name}: it can only be tested from a neighbour.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <tbody>
                    {byCity.slice(0, shown).map((each) => (
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
            {byCity.length > shown ? <p>And {byCity.length - shown} more cities.</p> : null}
          </section>
        </div>
      ) : (
        <section>
          <h2>Every country</h2>
          <p>
            {totals.bothCountries} countries have both data centres and probes.{" "}
            {totals.noProbeCountries} have data centres but no probe, so they can only be tested
            from a neighbour; {totals.noDatacentreCountries} have probes but no data centre, so
            their visitors are served from another country&apos;s.
          </p>
          <div className="table-scroll">
            <table className="countries">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Data centres</th>
                  <th>Probes</th>
                </tr>
              </thead>
              {continents.map((continent) => (
                <tbody key={continent.code}>
                  <tr className="continent">
                    <th scope="rowgroup">{continent.name}</th>
                    <th>{count(continent.datacentres)}</th>
                    <th>{count(continent.probes)}</th>
                  </tr>
                  {continent.countries.map((each) => (
                    <tr key={each.code}>
                      <td>
                        <Link href={routeUrl("/coverage", { query: { country: each.code } })}>
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
