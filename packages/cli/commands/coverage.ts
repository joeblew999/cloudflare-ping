// `cloudflare-ping coverage [--place Europe|TH]`: the geographical coverage map's
// data (`GET /api/coverage`), as a terminal can show it: every country, its data centres and
// probes, by continent; for a continent, just its countries; for a country, its data centres and
// probe cities. The same options as the page, the API and the MCP tool, sent as typed, with the
// command's own defaults; `--json` is the API's answer to them. The words are the page's
// (packages/shared/src/coverage.ts). The Coverage page (`/coverage?place=Europe`).
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { coverage as definition } from "@cloudflare-ping/shared/commands";
import {
  count,
  coverageGaps,
  coverageHeadline,
  coverageUnmatched,
} from "@cloudflare-ping/shared/coverage";
import { asked, commonOptions, headers, printedJson, siteOf } from "../api";

export async function coverage(args: Array<string>) {
  const { values } = parseArgs({
    args,
    options: { ...definition.cli.flags, ...commonOptions },
  });
  const site = siteOf(values.site);
  const found = await asked(() =>
    fetch("/api/coverage", {
      query: values.place ? { place: values.place } : {},
      baseURL: site,
      headers: headers(),
    }),
  );
  if (printedJson(values.json, found)) {
    return;
  }
  const { place, unmatched, continents, datacentres, cities } = found;
  if (unmatched) {
    console.log(`${coverageUnmatched(unmatched)}\n`);
  }
  console.log(`${coverageHeadline(found)}\n`);
  if (place?.kind === "country") {
    console.log("Data centres:");
    for (const each of datacentres) {
      console.log(`  ${each.code}  ${each.name}`);
    }
    if (cities.length > 0) {
      console.log("\nProbes, by city (the most first):");
      console.log(
        `  ${cities
          .slice(0, 12)
          .map(
            (each) => `${each.city}${each.state ? ` (${each.state})` : ""} ${count(each.probes)}`,
          )
          .join(", ")}${cities.length > 12 ? `, and ${cities.length - 12} more cities` : ""}`,
      );
    }
  } else {
    console.log(`${coverageGaps(found)}\n`);
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
  }
  if (found.totals.unplaced.length > 0) {
    console.log(`\nNot placed yet (no coordinates): ${found.totals.unplaced.join(" ")}`);
  }
  console.log(`\n${site}/coverage${place ? `?place=${encodeURIComponent(place.value)}` : ""}`);
}
