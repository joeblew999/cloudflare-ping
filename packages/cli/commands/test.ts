// `cloudflare-ping test [--from <place>] [--path <path>] [--probes <n>] [--host <target>]`:
// one Globalping test, sent by the app through its API (`POST /api/probe`): to our probe, or with
// `--host` straight to an allowed target, as a visitor would. Prints what came back, as it came
// back. The home page's "Run a probe".
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { test as definition } from "@cloudflare-ping/shared/commands";
import { commonOptions, headers, printedJson, signedIn, siteOf } from "../api";

export async function test(args: Array<string>) {
  const { values } = parseArgs({
    args,
    options: { ...definition.cli.flags, ...commonOptions },
  });
  const site = siteOf(values.site);

  const answer = await signedIn(site, (authorization) =>
    fetch("/api/probe", {
      method: "POST",
      baseURL: site,
      headers: headers(authorization),
      body: {
        from: values.from,
        path: values.path,
        probes: Number(values.probes),
        ...(values.host ? { host: values.host } : {}),
      },
    }),
  );

  if (printedJson(values.json, answer)) {
    return;
  }
  console.log(`Test ${answer.measurement}, from ${answer.from}, ${answer.site}${answer.path}\n`);
  for (const each of answer.results) {
    console.log(`${each.city}, ${each.country} (${each.network}, AS${each.asn})`);
    if (each.error) {
      console.log(`  ${each.status}: ${each.error}`);
    }
    console.log(`  HTTP ${each.httpStatus ?? "-"}, cf-ray ${each.ray}, ${each.totalMs ?? "-"} ms`);
    console.log(`  ${each.bodyBytes} bytes back${each.truncated ? ", cut off by the probe" : ""}`);
    if (each.isr) {
      console.log(`  x-isr-cache: ${each.isr}`);
    }
    if (values.host) {
      console.log("");
      continue;
    }
    console.log(`  answer: ${each.answer}`);
    console.log(
      `  ${each.same ? "same" : "DIFFERENT"}: answer ${each.colo || "-"}, cf-ray ${each.rayColo || "-"}\n`,
    );
  }
}
