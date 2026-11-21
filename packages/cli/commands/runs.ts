// `cloudflare-ping runs`: the newest runs (`GET /api/runs`), each with how many fetches it
// recorded. The Runs page's list.
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { runs as definition } from "@cloudflare-ping/shared/commands";
import { asked, commonOptions, headers, printedJson, siteOf } from "../api";

export async function runs(args: Array<string>) {
  const { values } = parseArgs({
    args,
    options: { ...definition.cli.flags, ...commonOptions },
  });
  const site = siteOf(values.site);

  const found = await asked(() =>
    fetch("/api/runs", {
      query: {
        ...(values.cursor ? { cursor: values.cursor } : {}),
        ...(values.limit ? { limit: values.limit } : {}),
      },
      baseURL: site,
      headers: headers(),
    }),
  );
  if (printedJson(values.json, found)) {
    return;
  }
  if (found.runs.length === 0) {
    console.log("No runs yet.");
  } else {
    for (const each of found.runs) {
      console.log(
        `${each.createdAt}  ${each.id}  ${each.fromPlace ?? "?"}  ${each.probes ?? "?"}×${each.repeat ?? 1}  ${each.fetches} fetches  ${each.target}`,
      );
    }
  }
  if (found.next) {
    console.log(`\nMore: cloudflare-ping runs --cursor ${found.next}`);
  }
}
