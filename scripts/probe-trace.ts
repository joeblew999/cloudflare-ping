// `vp run probe:trace -- <ray id> [--minutes <n>]`: Cloudflare's own record of a request, found
// by its ray ID in the account's Workers logs (`cf o11y telemetry query`, Cloudflare's CLI, with
// this machine's Cloudflare sign-in): which Worker ran it, in which data centre, from where, how it
// ended and how long it took; and the trace's spans, if the Worker records them (plan step 3).
// The ray IDs are the `cf-ray`s that `probe:test` prints, ours and the target's.
import { execFile } from "node:child_process";
import { parseArgs, promisify } from "node:util";
import { z } from "zod";

const { values, positionals } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  allowPositionals: true,
  options: { minutes: { type: "string", default: "60" } },
});
// A ray ID as `cf-ray` shows it ends in its data centre; the logs keep it without.
const ray = (positionals[0] ?? "").replace(/-[A-Z]{3}$/, "");
if (!/^[0-9a-f]{16}$/.test(ray)) {
  throw new Error(
    "Give a ray ID, as `cf-ray` shows it: vp run probe:trace -- a5ce25f789c2fa38-BKK",
  );
}

const run = promisify(execFile);
async function query(view: "events" | "traces", needle: string): Promise<unknown> {
  const to = Date.now();
  const from = to - Number(values.minutes) * 60_000;
  const body = {
    queryId: "adhoc",
    timeframe: { from, to },
    view,
    limit: 50,
    parameters: { needle: { value: needle } },
  };
  const { stdout } = await run(
    "cf",
    ["o11y", "telemetry", "query", "--body", JSON.stringify(body)],
    {
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return JSON.parse(stdout);
}

const event = z.object({
  source: z.object({ message: z.string().optional() }).optional(),
  timestamp: z.number(),
  $metadata: z.object({ service: z.string().optional(), traceId: z.string().optional() }),
  $workers: z
    .object({
      outcome: z.string().optional(),
      wallTimeMs: z.number().optional(),
      cpuTimeMs: z.number().optional(),
      event: z
        .object({
          request: z
            .object({
              cf: z
                .object({
                  colo: z.string().optional(),
                  city: z.string().optional(),
                  country: z.string().optional(),
                  asOrganization: z.string().optional(),
                })
                .optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});
const events = z.object({ events: z.object({ events: z.array(event) }) });
const traces = z.object({ traces: z.array(z.unknown()) });

const found = events.parse(await query("events", ray)).events.events;
if (found.length === 0) {
  console.log(`No Workers log for ray ${ray} in the last ${values.minutes} minutes.`);
}
for (const each of found) {
  const cf = each.$workers?.event?.request?.cf;
  console.log(`${new Date(each.timestamp).toISOString()}  ${each.$metadata.service ?? "?"}`);
  console.log(`  ${each.source?.message ?? ""}`);
  console.log(
    `  ran in ${cf?.colo ?? "?"}, for a request from ${cf?.asOrganization ?? "?"} (${cf?.city ?? "?"}, ${cf?.country ?? "?"})`,
  );
  console.log(
    `  ${each.$workers?.outcome ?? "?"}, ${each.$workers?.wallTimeMs ?? "?"} ms wall, ${each.$workers?.cpuTimeMs ?? "?"} ms CPU`,
  );
  const traceId = each.$metadata.traceId;
  if (traceId) {
    const spans = traces.parse(await query("traces", traceId)).traces;
    console.log(
      spans.length === 0
        ? `  trace ${traceId}: no spans (the Worker doesn't record traces)`
        : `  trace ${traceId}: ${JSON.stringify(spans, null, 2)}`,
    );
  }
  console.log("");
}
