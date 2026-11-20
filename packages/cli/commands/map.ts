// `cloudflare-ping map [--id <map id>]`: a map (`GET /api/map`, the newest unless given): which
// Cloudflare data centres Globalping's probes reached, and what it cost. The Map page.
// `cloudflare-ping remap [--level country|city] [--countries TH,SG]`: start a new one (`POST
// /api/map`, signed in: it spends one Globalping test per place). The Map page's "Start a map".
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { asked, headers, signedIn, siteOf, stop } from "../api";

export async function map(args: Array<string>) {
  const { values } = parseArgs({
    args,
    options: {
      id: { type: "string" },
      json: { type: "boolean", default: false },
      site: { type: "string" },
    },
  });
  const site = siteOf(values.site);
  const found = await asked(() =>
    fetch("/api/map", {
      query: values.id ? { id: values.id } : {},
      baseURL: site,
      headers: headers(),
    }),
  );
  if (values.json) {
    console.log(JSON.stringify(found, null, 2));
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
    options: {
      level: { type: "string", default: "country" },
      countries: { type: "string" },
      json: { type: "boolean", default: false },
      site: { type: "string" },
    },
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
  if (values.json) {
    console.log(JSON.stringify(started, null, 2));
    return;
  }
  console.log(
    `Map ${started.id} started, by ${started.level}: ${started.places} places in ${started.countries} countries, ${started.tests} Globalping tests.`,
  );
  console.log(`It fills in as its queue works through them. Follow it with: cloudflare-ping map`);
}
