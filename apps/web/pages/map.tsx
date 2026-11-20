// The map (plan step 7): which Cloudflare data centres Globalping's probes reach, and what it
// cost to find out (the CLI's `map`); and starting a new one (Void's page action, running
// src/commands/map.ts as `POST /api/map` does; the CLI's `remap`). A map fills in as its queue
// works through the countries, waiting out Globalping's hourly limit when it must.
import { Form, Link, useForm } from "@void/react";
import { PlaceChips } from "../src/PlacePicker";
import type { Props } from "./map.server";

// Every country, unless some are given.
const ALL: Array<string> = [];

export default function MapPage({
  email,
  map,
  tests,
  missed,
  countriesDone,
  reached,
  datacentres,
}: Props) {
  const form = useForm("/map", { level: "country", countries: ALL }, { throwOnError: false });

  const command = [
    "cloudflare-ping remap",
    `--level ${form.data.level}`,
    ...(form.data.countries && form.data.countries.length > 0
      ? [`--countries ${form.data.countries.join(",")}`]
      : []),
  ].join(" ");

  return (
    <main className="content wide vp-doc">
      <h1>The map</h1>
      <p className="lead">
        Which of Cloudflare&apos;s data centres Globalping&apos;s probes reach, and what it costs to
        find out: one probe in each place asks our <code>/where</code> which data centre it reached.
      </p>

      {map ? (
        <>
          <p>
            By {map.level}, started {map.createdAt.slice(0, 16).replace("T", " ")}: {tests} of{" "}
            {map.places} places answered, in {countriesDone} of {map.countries} countries
            {missed > 0 ? `; ${missed} didn't reach /where` : ""}. It reached{" "}
            <strong>{reached.length}</strong> of the {datacentres} data centres Cloudflare lists.{" "}
            <Link href="/map">Refresh</Link>
          </p>
          <p>
            The same from a terminal: <code>cloudflare-ping map</code>
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data centre</th>
                  <th>Where</th>
                  <th>Region</th>
                  <th>Places</th>
                  <th>From countries</th>
                </tr>
              </thead>
              <tbody>
                {reached.map((each) => (
                  <tr key={each.colo ?? "?"}>
                    <td>
                      <code>{each.colo}</code>
                    </td>
                    <td>{each.name ?? "?"}</td>
                    <td>{each.region ?? "?"}</td>
                    <td>{each.places}</td>
                    <td>{each.countries}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p>No map yet.</p>
      )}

      <h2>Make a new map</h2>
      <div className="custom-block warning">
        <p>
          It spends one Globalping test per place: about 120 by country, about 1,100 by city.
          Without the app&apos;s Globalping token, that comes out of a shared allowance, and a long
          map waits whenever it runs out.
        </p>
      </div>
      <Form
        form={form}
        className="form"
        renderError={(error) => (
          <div className="custom-block danger">
            <p>{error.message}</p>
          </div>
        )}
      >
        <div className="form-row">
          <label>
            One probe per
            <select
              value={form.data.level}
              onChange={(event) =>
                form.setData("level", event.target.value === "city" ? "city" : "country")
              }
            >
              <option value="country">country</option>
              <option value="city">city</option>
            </select>
          </label>
          <div className="field">
            <span>Only these countries (optional)</span>
            <PlaceChips
              label="Only these countries"
              value={form.data.countries ?? ALL}
              kinds={["country"]}
              placeholder="Type a country: Thailand, SG…"
              onChange={(countries) => form.setData("countries", countries)}
            />
            {form.errors.countries ? (
              <span className="different">{form.errors.countries}</span>
            ) : null}
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="button brand" disabled={form.pending || !email}>
            {form.pending ? "Starting…" : email ? "Start a map" : "Sign in to start a map"}
          </button>
        </div>
      </Form>
      <p>
        The same from a terminal: <code>{command}</code>
      </p>
    </main>
  );
}
