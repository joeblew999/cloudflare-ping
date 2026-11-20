// `cloudflare-ping coverage`: the geographical coverage map's data (`GET /api/coverage`), as a
// terminal can show it: all of Cloudflare's data centres, by region, and Globalping's probes, by
// country. `--json` gives the whole of it, with every place. The Coverage page.
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { asked, commonOptions, headers, printedJson, siteOf } from "../api";

export async function coverage(args: Array<string>) {
  const { values } = parseArgs({
    args,
    options: { ...commonOptions },
  });
  const site = siteOf(values.site);
  const found = await asked(() => fetch("/api/coverage", { baseURL: site, headers: headers() }));
  if (printedJson(values.json, found)) {
    return;
  }
  const { totals, regions, probeCountries } = found;
  // Thousands with commas, as the page shows them.
  const count = (n: number) => n.toLocaleString("en-US");
  console.log(
    `All ${totals.datacentres} of Cloudflare's data centres, and Globalping's ${count(totals.probes)} probes in ${count(totals.cities)} cities in ${totals.countries} countries.\n`,
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
