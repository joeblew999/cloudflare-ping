// `cloudflare-ping map [--id <map id>]`: a map (`GET /api/map`, the newest unless given): which
// Cloudflare data centres Globalping's probes reached, and what it cost. The Map page.
// `cloudflare-ping remap [--level country|city] [--countries TH,SG]`: start a new one (`POST
// /api/map`, signed in: it spends one Globalping test per place). The Map page's "Start a map".
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { map as mapDefinition, remap as remapDefinition } from "@cloudflare-ping/shared/commands";
import { asked, commonOptions, headers, printedJson, signedIn, siteOf, stop } from "../api";

export async function map(args: Array<string>) {
  const { values } = parseArgs({
    args,
    options: { ...mapDefinition.cli.flags, ...commonOptions },
  });
  const site = siteOf(values.site);
  const found = await asked(() =>
    fetch("/api/map", {
      query: values.id ? { id: values.id } : {},
      baseURL: site,
      headers: headers(),
    }),
  );
  if (printedJson(values.json, found)) {
    return;
  }
  if (!found.map) {
    console.log("No map yet. Start one with: cloudflare-ping remap --level country");
    return;
  }
  const { map: one, tests, missed, countriesDone, reached, datacentres } = found;
  console.log(
    `Map ${one.id}, by ${one.level}, started ${one.createdAt}: ${tests} of ${one.places} places answered, in ${countriesDone} of ${one.countries} countries${missed > 0 ? `; ${missed} didn't reach /where` : ""}.`,
  );
  console.log(
    `It reached ${reached.length} of the ${datacentres} data centres Cloudflare lists.\n`,
  );
  for (const each of reached) {
    console.log(
      `  ${each.colo ?? "?"}  ${(each.name ?? "?").padEnd(32)} ${String(each.places).padStart(4)} places  from ${each.countries}`,
    );
  }
}

export async function remap(args: Array<string>) {
  const { values } = parseArgs({
    args,
    options: { ...remapDefinition.cli.flags, ...commonOptions },
  });
  const site = siteOf(values.site);
  const level = values.level;
  if (level !== "country" && level !== "city") {
    return stop(new Error("--level is country or city"));
  }
  const countries = values.countries
    ?.split(",")
    .map((each) => each.trim())
    .filter((each) => each !== "");
  const started = await signedIn(site, (authorization) =>
    fetch("/api/map", {
      method: "POST",
      body: { level, ...(countries && countries.length > 0 ? { countries } : {}) },
      baseURL: site,
      headers: headers(authorization),
    }),
  );
  if (printedJson(values.json, started)) {
    return;
  }
  console.log(
    `Map ${started.id} started, by ${started.level}: ${started.places} places in ${started.countries} countries, ${started.tests} tests.`,
  );
  console.log(`It fills in as its queue works through them. Follow it with: cloudflare-ping map`);
}
