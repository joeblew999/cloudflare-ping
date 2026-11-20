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
  const { country, unmatched, totals, regions, probeCountries, datacentres, cities } = found;
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
  console.log("Data centres, by region:");
  for (const each of regions) {
    console.log(`  ${each.region.padEnd(36)} ${String(each.datacentres).padStart(4)}`);
  }
  console.log("\nProbes, by country (the most first):");
  console.log(
    `  ${probeCountries
      .slice(0, 12)
      .map((each) => `${each.country} ${count(each.probes)}`)
      .join(", ")}, and ${Math.max(probeCountries.length - 12, 0)} more countries`,
  );
  if (totals.unplaced.length > 0) {
    console.log(`\nNot placed yet (no coordinates): ${totals.unplaced.join(" ")}`);
  }
  console.log(`\n${site}/coverage`);
}
