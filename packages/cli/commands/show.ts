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

  const { run, fetches } = await asked(() =>
    fetch("/api/runs/[id]", { params: { id }, baseURL: site, headers: headers() }),
  );
  if (values.json) {
    console.log(JSON.stringify({ run, fetches }, null, 2));
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
    console.log(`  Didn't start: ${run.error}`);
  }
  console.log(`  ${site}/runs/${run.id}\n`);
  for (const row of fetches) {
    printRow(row);
  }
  console.log(`\n${fetches.length} fetches recorded.`);
}
