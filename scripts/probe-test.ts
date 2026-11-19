// `vp run probe:test --from <place> --path <path>`: one Globalping HTTP test to the deployed
// probe (https://cloudflare-ping.gedw99.workers.dev), from probes in <place> (Globalping's "magic"
// place: a country such as TH, a city, a network), and what came back, as it came back: the data
// centre the probe's answer names, and the code that ends its `cf-ray` header. Step 1's proof is
// that the two are the same. Globalping without an account: 250 tests an hour per IP address
// (globalping.io/credits, checked 2026-11-19).
import { parseArgs } from "node:util";

const SITE = "cloudflare-ping.gedw99.workers.dev";
const API = "https://api.globalping.io/v1/measurements";

const { values } = parseArgs({
  // `vp run` passes its own "--" through.
  args: process.argv.slice(2).filter((arg) => arg !== "--"),
  options: {
    from: { type: "string", default: "TH" },
    path: { type: "string", default: "/where" },
    probes: { type: "string", default: "1" },
  },
});

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
const text = (value: unknown): string => (typeof value === "string" ? value : "");

const started = await fetch(API, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    type: "http",
    target: SITE,
    locations: [{ magic: values.from, limit: Number(values.probes) }],
    measurementOptions: { protocol: "HTTPS", request: { method: "GET", path: values.path } },
  }),
});
const created: unknown = await started.json();
const id = text(field(created, "id"));
if (!started.ok || !id) {
  throw new Error(`Globalping answered ${started.status}: ${JSON.stringify(created)}`);
}

let measurement: unknown;
do {
  await new Promise((done) => setTimeout(done, 1000));
  measurement = await (await fetch(`${API}/${id}`)).json();
} while (text(field(measurement, "status")) === "in-progress");

console.log(`Globalping measurement ${id}, from ${values.from}, ${SITE}${values.path}\n`);
const results = field(measurement, "results");
for (const each of Array.isArray(results) ? results : []) {
  const probe = field(each, "probe");
  const result = field(each, "result");
  const headers = field(result, "headers");
  const ray = text(field(headers, "cf-ray"));
  const body = text(field(result, "rawBody"));
  let colo = "";
  try {
    colo = text(field(JSON.parse(body), "colo"));
  } catch {
    colo = "";
  }
  const rayColo = ray.split("-").pop() ?? "";
  console.log(
    `${text(field(probe, "city"))}, ${text(field(probe, "country"))} (${text(field(probe, "network"))}, AS${String(field(probe, "asn"))})`,
  );
  console.log(`  HTTP ${String(field(result, "statusCode"))}, cf-ray ${ray}`);
  console.log(`  answer: ${body}`);
  console.log(
    `  ${colo && colo === rayColo ? "same" : "DIFFERENT"}: answer ${colo || "-"}, cf-ray ${rayColo || "-"}\n`,
  );
}
