// `cloudflare-ping runs`: the newest runs (`GET /api/runs`), each with how many fetches it
// recorded. The Runs page's list.
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { asked, headers, siteOf } from "../api";

export async function runs(args: Array<string>) {
  const { values } = parseArgs({
    args,
    options: { json: { type: "boolean", default: false }, site: { type: "string" } },
  });
  const site = siteOf(values.site);

  const found = await asked(() => fetch("/api/runs", { baseURL: site, headers: headers() }));
  if (values.json) {
    console.log(JSON.stringify(found.runs, null, 2));
  } else if (found.runs.length === 0) {
    console.log("No runs yet.");
  } else {
    for (const each of found.runs) {
      console.log(
        `${each.createdAt}  ${each.id}  ${each.fromPlace ?? "?"}  ${each.probes ?? "?"}×${each.repeat ?? 1}  ${each.fetches} fetches  ${each.target}`,
      );
    }
  }
}
