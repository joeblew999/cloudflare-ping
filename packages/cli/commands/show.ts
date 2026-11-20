// `cloudflare-ping show <run id>`: one run and its recorded fetches (`GET /api/runs/<id>`). A
// run's page.
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { asked, headers, printRow, siteOf, stop } from "../api";

export async function show(args: Array<string>) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { json: { type: "boolean", default: false }, site: { type: "string" } },
  });
  const site = siteOf(values.site);
  const id = positionals[0];
  if (!id) {
    return stop(new Error("Give a run's ID: cloudflare-ping show <run id> (runs lists them)"));
  }

  const { run, fetches, places } = await asked(() =>
    fetch("/api/runs/[id]", { params: { id }, baseURL: site, headers: headers() }),
  );
  if (values.json) {
    console.log(JSON.stringify({ run, fetches, places }, null, 2));
    return;
  }
  const mode = run.background === null ? "?" : run.background ? "in the background" : "inline";
  console.log(`Run ${run.id}: ${run.target}`);
  console.log(
    `  from ${run.fromPlace ?? "?"}, ${run.probes ?? "?"} probes × ${run.repeat ?? 1}, ${mode}, started ${run.createdAt}`,
  );
  if (run.measurement) {
    console.log(`  Globalping measurement ${run.measurement}`);
  }
  if (run.error) {
    console.log(`  ${run.measurement ? "Went wrong" : "Didn't start"}: ${run.error}`);
  }
  console.log(`  ${site}/runs/${run.id}\n`);
  for (const row of fetches) {
    printRow(row);
  }
  console.log(`\n${fetches.length} fetches recorded.`);
  if (places.length > 0) {
    // A run everywhere: the data centres it expected, against those its fetches ran in.
    const reached = new Set(fetches.map((row) => row.colo));
    const expected = new Set(places.map((place) => place.colo));
    const waiting = places.filter((place) => !reached.has(place.colo));
    const elsewhere = [...reached].filter((colo) => colo && !expected.has(colo));
    console.log(
      `Everywhere: ${places.length - waiting.length} of ${places.length} data centres reached.`,
    );
    for (const place of waiting) {
      console.log(
        `  ${place.colo} (from ${place.city}, ${place.country}): ${place.error ?? (place.measurement ? "not yet" : "queued")}`,
      );
    }
    if (elsewhere.length > 0) {
      console.log(`  Probes landed elsewhere too: ${elsewhere.join(", ")}`);
    }
  }
}
