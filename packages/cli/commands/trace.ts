// `cloudflare-ping trace <ray id> [--minutes <n>]`: Cloudflare's own record of a request, by its
// ray ID, through the app's API (`GET /api/trace/<ray id>`, which reads the account's Workers
// logs: src/trace.ts): which Worker ran it, in which data centre, for a request from where, how it
// ended and how long it took (plan step 3). A request's page (/trace/<ray id>). The ray IDs are
// the `cf-ray`s that `test` and `run` print.
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { commonOptions, headers, printedJson, signedIn, siteOf, stop } from "../api";

export async function trace(args: Array<string>) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      minutes: { type: "string", default: "60" },
      ...commonOptions,
    },
  });
  const site = siteOf(values.site);
  const ray = positionals[0] ?? "";
  if (!/^[0-9a-f]{16}(-[A-Z]{3})?$/.test(ray)) {
    return stop(
      new Error("Give a ray ID, as cf-ray shows it: cloudflare-ping trace a5ce25f789c2fa38-BKK"),
    );
  }

  const found = await signedIn(site, (authorization) =>
    fetch("/api/trace/[ray]", {
      params: { ray },
      query: { minutes: values.minutes },
      baseURL: site,
      headers: headers(authorization),
    }),
  );

  if (printedJson(values.json, found)) {
    return;
  }
  if (found.logs.length === 0) {
    console.log(`No Workers log for ray ${found.ray} in the last ${found.minutes} minutes.`);
  } else {
    for (const log of found.logs.filter((each) => each.kind === "request")) {
      console.log(`${log.at}  the ${log.service ?? "?"} Worker`);
      console.log(
        `  ran in ${log.colo ?? "?"}, for a request from ${log.from ?? "?"} (${log.city ?? "?"}, ${log.country ?? "?"})`,
      );
      console.log(
        `  ${log.outcome ?? "?"}, ${log.wallTimeMs ?? "?"} ms wall, ${log.cpuTimeMs ?? "?"} ms CPU, ${log.spans > 0 ? `${log.spans} trace spans` : "no trace spans"}`,
      );
    }
    const lines = found.logs.filter((each) => each.kind === "line");
    if (lines.length > 0) {
      console.log("\nWhat it logged:");
      for (const line of lines) {
        console.log(`  ${line.at.slice(11, 23)}  ${line.message ?? ""}`);
      }
    }
  }
}
