// `vp run ping:show -- <run id> [--json] [--site <url>]`: one run and its recorded fetches
// (`GET /api/runs/<id>`). A run's page.
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { argv, asked, printRow, siteOf } from "./api";

const { values, positionals } = parseArgs({
  args: argv(),
  allowPositionals: true,
  options: { json: { type: "boolean", default: false }, site: { type: "string" } },
});
const site = siteOf(values.site);
const id = positionals[0];
if (!id) {
  throw new Error("Give a run's ID: vp run ping:show -- <run id> (vp run ping:runs lists them)");
}

const { run, fetches } = await asked(() =>
  fetch("/api/runs/[id]", { params: { id }, baseURL: site }),
);
if (values.json) {
  console.log(JSON.stringify({ run, fetches }, null, 2));
} else {
  console.log(`Run ${run.id}: ${run.target}`);
  console.log(
    `  from ${run.fromPlace ?? "?"}, ${run.probes ?? "?"} probes × ${run.repeat ?? 1}, ${run.background === null ? "?" : run.background ? "in the background" : "inline"}, started ${run.createdAt}`,
  );
  if (run.measurement) {
    console.log(`  Globalping measurement ${run.measurement}`);
  }
  console.log(`  ${site}/runs/${run.id}\n`);
  for (const row of fetches) {
    printRow(row);
  }
  console.log(`\n${fetches.length} fetches recorded.`);
}
