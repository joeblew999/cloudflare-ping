// `cloudflare-ping limits`: how many Globalping tests the app has left this hour (`GET
// /api/limits`), as the Worker sees it. The Runs page's line above the form.
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { limits as definition } from "@cloudflare-ping/shared/commands";
import { limitsLine } from "@cloudflare-ping/shared/limits";
import { asked, commonOptions, headers, printedJson, siteOf } from "../api";

export async function limits(args: Array<string>) {
  const { values } = parseArgs({
    args,
    options: { ...definition.cli.flags, ...commonOptions },
  });
  const site = siteOf(values.site);

  const found = await asked(() => fetch("/api/limits", { baseURL: site, headers: headers() }));
  if (printedJson(values.json, found)) {
    return;
  }
  console.log(limitsLine(found));
}
