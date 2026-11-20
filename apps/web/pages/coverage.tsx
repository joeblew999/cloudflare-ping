// The geographical coverage map (plan 2026-11-20-03): every one of Cloudflare's data centres and
// every one of Globalping's probes, on a world map, complete: where the app can run, and where it
// can be reached from. None of our own test results (those are the geographical probe map, on
// the same drawing: src/WorldMap.tsx). The CLI's `coverage`; `GET /api/coverage`.
import { WorldMap, type WorldPoint } from "../src/WorldMap";
import type { Props } from "./coverage.server";

export default function CoveragePage({
  totals,
  regions,
  probeCountries,
  datacentres,
  cities,
}: Props) {
  const points: Array<WorldPoint> = [
    ...cities.map((each) => ({
      key: `${each.country}|${each.city}`,
      lat: each.lat,
      lon: each.lon,
      className: "probe",
      r: 0.6,
      title: `${each.city}, ${each.country}: ${each.probes} Globalping ${each.probes === 1 ? "probe" : "probes"}`,
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
  const shown = 8;
  // Thousands with commas, the same on the server and in the browser.
  const count = (n: number) => n.toLocaleString("en-US");
  return (
    <main className="content wide vp-doc">
      <h1>Coverage</h1>
      <p className="lead">
        All <strong>{totals.datacentres}</strong> of Cloudflare&apos;s data centres, and
        Globalping&apos;s <strong>{count(totals.probes)}</strong> probes in {count(totals.cities)}{" "}
        cities in {totals.countries} countries: everywhere the app can run, and everywhere it can be
        reached from.
      </p>

      <figure className="coverage">
        <WorldMap
          points={points}
          label={`A world map of Cloudflare's ${totals.datacentres} data centres and Globalping's ${count(totals.probes)} probes`}
        />
        <figcaption>
          <span className="key dc" /> Cloudflare data centres · <span className="key probe" />{" "}
          Globalping probes
        </figcaption>
      </figure>

      <p>
        The same from a terminal: <code>cloudflare-ping coverage</code>
      </p>

      <div className="form-row">
        <section>
          <h2>Data centres, by region</h2>
          <div className="table-scroll">
            <table>
              <tbody>
                {regions.map((each) => (
                  <tr key={each.region}>
                    <td>{each.region}</td>
                    <td>{each.datacentres}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <h2>Probes, by country</h2>
          <div className="table-scroll">
            <table>
              <tbody>
                {probeCountries.slice(0, shown).map((each) => (
                  <tr key={each.country}>
                    <td>{each.country}</td>
                    <td>{count(each.probes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {probeCountries.length > shown ? (
            <p>And {probeCountries.length - shown} more countries.</p>
          ) : null}
        </section>
      </div>

      {totals.unplaced.length > 0 ? (
        <p>Not on the map yet, since their place isn&apos;t known: {totals.unplaced.join(", ")}.</p>
      ) : null}
    </main>
  );
}
