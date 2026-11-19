// `vp run ping:runs -- [--json] [--site <url>]`: the newest runs (`GET /api/runs`), each with how
// many fetches it recorded. The Runs page's list.
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { argv, asked, siteOf } from "./api";

const { values } = parseArgs({
  args: argv(),
  options: { json: { type: "boolean", default: false }, site: { type: "string" } },
});
const site = siteOf(values.site);

const { runs } = await asked(() => fetch("/api/runs", { baseURL: site }));
if (values.json) {
  console.log(JSON.stringify(runs, null, 2));
} else if (runs.length === 0) {
  console.log("No runs yet.");
} else {
  for (const run of runs) {
    console.log(
      `${run.createdAt}  ${run.id}  ${run.fromPlace ?? "?"}  ${run.probes ?? "?"}×${run.repeat ?? 1}  ${run.fetches} fetches  ${run.target}`,
    );
  }
}
