// `cloudflare-ping coverage [--country TH]`: the geographical coverage map's data
// (`GET /api/coverage`), as a terminal can show it: all of Cloudflare's data centres, by region,
// and Globalping's probes, by country; or one country's data centres and probe cities. `--json`
// gives the whole of it, with every place. The Coverage page (`/coverage?country=TH`).
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { asked, commonOptions, headers, printedJson, siteOf } from "../api";

export async function coverage(args: Array<string>) {
  const { values } = parseArgs({
    args,
    options: { country: { type: "string" }, ...commonOptions },
  });
  const site = siteOf(values.site);
  const found = await asked(() =>
    fetch("/api/coverage", {
      query: values.country ? { country: values.country } : {},
      baseURL: site,
      headers: headers(),
    }),
  );
  if (printedJson(values.json, found)) {
    return;
  }
  const { country, unmatched, totals, continents, datacentres, cities } = found;
  if (unmatched) {
    console.log(`No country with probes matches "${unmatched}": here is every country.\n`);
  }
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
    const byCity = [...cities].sort((a, b) => b.probes - a.probes);
    console.log(
      `  ${byCity
        .slice(0, 12)
        .map((each) => `${each.city}${each.state ? ` (${each.state})` : ""} ${count(each.probes)}`)
        .join(", ")}${byCity.length > 12 ? `, and ${byCity.length - 12} more cities` : ""}`,
    );
    console.log(`\n${site}/coverage?country=${country.code}`);
    return;
  }
  console.log(
    `All ${totals.datacentres} of Cloudflare's data centres, and ${count(totals.probes)} probes in ${count(totals.cities)} cities in ${totals.countries} countries.\n`,
  );
  console.log(
    `${totals.bothCountries} countries have both data centres and probes; ${totals.noProbeCountries} have data centres but no probe; ${totals.noDatacentreCountries} have probes but no data centre.\n`,
  );
  // As the page shows it: every country, its data centres and probes, by continent.
  const row = (name: string, centres: string, probes: string) =>
    `${name.padEnd(34)} ${centres.padStart(12)} ${probes.padStart(8)}`;
  const shown = (n: number) => (n === 0 ? "none" : count(n));
  console.log(row("", "Data centres", "Probes"));
  for (const continent of continents) {
    console.log(`\n${row(continent.name, count(continent.datacentres), count(continent.probes))}`);
    for (const each of continent.countries) {
      console.log(
        row(`  ${each.name} (${each.code})`, shown(each.datacentres), shown(each.probes)),
      );
    }
  }
  if (totals.unplaced.length > 0) {
    console.log(`\nNot placed yet (no coordinates): ${totals.unplaced.join(" ")}`);
  }
  console.log(`\n${site}/coverage`);
}
