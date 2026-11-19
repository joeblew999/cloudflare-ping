// `cloudflare-ping run [--target <url>] [--from <place>] [--probes <n>] [--repeat <n>]
// [--inline]`: start a run through the app's API (`POST /api/runs`), then print its fetches as
// they're recorded (`GET /api/runs/<id>`), for up to 45 seconds or until all the expected ones
// are in. The Runs page's "Start a run". In the background unless `--inline`.
import { parseArgs } from "node:util";
import { fetch } from "void/client";
import { DEFAULT_TARGET } from "../../src/targets";
import { asked, headers, printRow, signedIn, siteOf } from "../api";

export async function run(args: Array<string>) {
  const { values } = parseArgs({
    args,
    options: {
      target: { type: "string", default: DEFAULT_TARGET },
      from: { type: "string", default: "TH" },
      probes: { type: "string", default: "2" },
      repeat: { type: "string", default: "1" },
      inline: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      site: { type: "string" },
    },
  });
  const site = siteOf(values.site);

  const started = await signedIn(site, (authorization) =>
    fetch("/api/runs", {
      method: "POST",
      baseURL: site,
      headers: headers(authorization),
      body: {
        target: values.target,
        from: values.from,
        probes: Number(values.probes),
        repeat: Number(values.repeat),
        background: !values.inline,
      },
    }),
  );

  if (!values.json) {
    console.log(`Run ${started.id}: ${values.target}, from ${values.from}`);
    console.log(`  Globalping measurement ${started.test.measurement}`);
    for (const each of started.test.results) {
      console.log(
        `  ${each.city}, ${each.country} (${each.network}): reached ${each.rayColo || "-"}${each.error ? `, ${each.error}` : ""}`,
      );
    }
    console.log(`  ${site}/runs/${started.id}\n`);
  }

  const read = () =>
    asked(() =>
      fetch("/api/runs/[id]", { params: { id: started.id }, baseURL: site, headers: headers() }),
    );
  let shown = 0;
  const until = Date.now() + 45_000;
  let found = await read();
  for (;;) {
    if (!values.json) {
      for (const row of found.fetches.slice(shown)) {
        printRow(row);
      }
    }
    shown = found.fetches.length;
    if (shown >= started.expected || Date.now() > until) {
      break;
    }
    await new Promise((wait) => setTimeout(wait, 1500));
    found = await read();
  }

  if (values.json) {
    console.log(JSON.stringify(found, null, 2));
  } else {
    console.log(`\n${shown} of ${started.expected} fetches recorded.`);
  }
}
