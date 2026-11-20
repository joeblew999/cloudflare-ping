// `cloudflare-ping coverage [--place Europe|TH] [--cities]`: the geographical coverage map's data
// (`GET /api/coverage`), as a terminal can show it: every country, its data centres and probes, by
// continent; for a continent, just its countries; for a country, its data centres and probe
// cities. `--json` gives the whole of it. The Coverage page (`/coverage?place=Europe`).
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { asked, commonOptions, headers, printedJson, siteOf } from "../api";

export async function coverage(args: Array<string>) {
  const { values } = parseArgs({
    args,
    options: {
      place: { type: "string" },
      cities: { type: "boolean", default: false },
      ...commonOptions,
    },
  });
  const site = siteOf(values.site);
  // The same options as the page, the API and the MCP tool. The cities are asked for, as anyone
  // asks for them: with `--cities`, or because a place's cities may be listed below.
  const found = await asked(() =>
    fetch("/api/coverage", {
      query: {
        ...(values.place ? { place: values.place } : {}),
        ...(values.cities || values.place ? { cities: "true" } : {}),
      },
      baseURL: site,
      headers: headers(),
    }),
  );
  if (printedJson(values.json, found)) {
    return;
  }
  const { place, unmatched, totals, continents, datacentres, cities } = found;
  if (unmatched) {
    console.log(
      `No continent or country with probes matches "${unmatched}": here is everywhere.\n`,
    );
  }
  // A country gets its own view; a continent, the every-country table of just its countries. As
  // the page writes them: a country by its code, a continent by its name.
  const country = place?.kind === "country" ? place : null;
  const link = place
    ? `${site}/coverage?place=${encodeURIComponent(country ? country.code : place.name)}`
    : `${site}/coverage`;
  // Thousands with commas, as the page shows them.
  const count = (n: number) => n.toLocaleString("en-US");
  if (country) {
    console.log(
      `${country.name} (${country.code}): ${totals.datacentres} of Cloudflare's data centres, and ${count(totals.probes)} probes in ${count(totals.cities)} ${totals.cities === 1 ? "city" : "cities"}.\n`,
    );
    console.log("Data centres:");
    for (const each of datacentres) {
      console.log(`  ${each.code}  ${each.name}`);
    }
    console.log("\nProbes, by city (the most first):");
    console.log(
      `  ${cities
        .slice(0, 12)
        .map((each) => `${each.city}${each.state ? ` (${each.state})` : ""} ${count(each.probes)}`)
        .join(", ")}${cities.length > 12 ? `, and ${cities.length - 12} more cities` : ""}`,
    );
    console.log(`\n${link}`);
    return;
  }
  console.log(
    `${place ? `${place.name}: ${totals.datacentres} of Cloudflare's data centres` : `All ${totals.datacentres} of Cloudflare's data centres`}, and ${count(totals.probes)} probes in ${count(totals.cities)} cities in ${totals.countries} countries.\n`,
  );
  console.log(
    `${totals.bothCountries} countries have both data centres and probes; ${totals.noProbeCountries} have data centres but no probe; ${totals.noDatacentreCountries} have probes but no data centre.\n`,
  );
  // As the page shows it: the continent once, beside its countries, then its total.
  const row = (continent: string, name: string, centres: string, probes: string) =>
    `${continent.padEnd(15)} ${name.padEnd(36)} ${centres.padStart(12)} ${probes.padStart(8)}`;
  const shown = (n: number) => (n === 0 ? "none" : count(n));
  console.log(row("Continent", "Country", "Data centres", "Probes"));
  for (const continent of continents) {
    console.log("");
    continent.countries.forEach((each, at) => {
      console.log(
        row(
          at === 0 ? continent.name : "",
          `${each.name} (${each.code})`,
          shown(each.datacentres),
          shown(each.probes),
        ),
      );
    });
    console.log(
      row("", `All of ${continent.name}`, count(continent.datacentres), count(continent.probes)),
    );
  }
  if (totals.unplaced.length > 0) {
    console.log(`\nNot placed yet (no coordinates): ${totals.unplaced.join(" ")}`);
  }
  console.log(`\n${link}`);
}
