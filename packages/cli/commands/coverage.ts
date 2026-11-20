// `cloudflare-ping coverage`: the geographical coverage map's data (`GET /api/coverage`), as a
// terminal can show it: all of Cloudflare's data centres, by region, and Globalping's probes, by
// country. `--json` gives the whole of it, with every place. The Coverage page.
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { asked, headers, siteOf } from "../api";

export async function coverage(args: Array<string>) {
  const { values } = parseArgs({
    args,
    options: { json: { type: "boolean", default: false }, site: { type: "string" } },
  });
  const site = siteOf(values.site);
  const found = await asked(() => fetch("/api/coverage", { baseURL: site, headers: headers() }));
  if (values.json) {
    console.log(JSON.stringify(found, null, 2));
    return;
  }
  const { totals, regions, probeCountries } = found;
  console.log(
    `All ${totals.datacentres} of Cloudflare's data centres, and Globalping's ${totals.probes} probes in ${totals.cities} cities in ${totals.countries} countries.\n`,
  );
  console.log("Data centres, by region:");
  for (const each of regions) {
    console.log(`  ${each.region.padEnd(36)} ${String(each.datacentres).padStart(4)}`);
  }
  console.log("\nProbes, by country (the most first):");
  console.log(
    `  ${probeCountries
      .slice(0, 12)
      .map((each) => `${each.country} ${each.probes}`)
      .join(", ")}, and ${Math.max(probeCountries.length - 12, 0)} more countries`,
  );
  if (totals.unplaced.length > 0) {
    console.log(`\nNot placed yet (no coordinates): ${totals.unplaced.join(" ")}`);
  }
  console.log(`\n${site}/coverage`);
}
