// One Globalping HTTP test to the deployed probe, from probes in a given place (Globalping's
// "magic" place: a country such as TH, a city, a network), and what came back: the data centre the
// probe's answer names, and the code that ends its `cf-ray` header. Step 1's proof is that the two
// are the same. Run by the app (`POST /api/probe`, plan step 6), not by the machine asking.
// Without a token, Globalping allows 250 tests an hour per IP address; with an account's token,
// 500 (globalping.io/credits, checked 2026-11-19).
import { z } from "zod";
import { SITE } from "@cloudflare-ping/shared/site";
import { ALLOWED_HOSTS } from "@cloudflare-ping/shared/targets";

const API = "https://api.globalping.io/v1/measurements";

const created = z.object({ id: z.string() });
const measurement = z.object({
  status: z.string(),
  results: z.array(
    z.object({
      probe: z.object({
        city: z.string(),
        country: z.string(),
        network: z.string(),
        asn: z.number(),
      }),
      result: z.object({
        status: z.string(),
        statusCode: z.number().nullish(),
        headers: z.record(z.string(), z.union([z.string(), z.array(z.string())])).nullish(),
        rawBody: z.string().nullish(),
        rawOutput: z.string().nullish(),
        truncated: z.boolean().nullish(),
        timings: z.object({ total: z.number().nullish() }).nullish(),
      }),
    }),
  ),
});
const answer = z.object({ colo: z.string() });

// The data centre an answer names; from the text itself when the answer was cut off (step 2).
function coloOf(raw: string): string {
  try {
    const parsed = answer.safeParse(JSON.parse(raw));
    if (parsed.success) {
      return parsed.data.colo;
    }
  } catch {
    // Cut off, or not JSON: read it from the text.
  }
  return /"colo":"([A-Z]{3})"/.exec(raw)?.[1] ?? "";
}

// `host`: our own probe (SITE) unless given; another only if `/run` may fetch it too
// (packages/shared/src/targets.ts), to fetch a target directly, as any visitor would (plan step 4).
export type ProbeOptions = {
  from: string;
  path: string;
  probes: number;
  host?: string;
  token?: string;
};

export async function probeFrom(options: ProbeOptions) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }
  // Globalping takes the query string apart from the path.
  const mark = options.path.indexOf("?");
  const path = mark === -1 ? options.path : options.path.slice(0, mark);
  const query = mark === -1 ? "" : options.path.slice(mark + 1);
  const host = options.host ?? SITE;
  if (host !== SITE && !ALLOWED_HOSTS.has(host)) {
    throw new Error(`Not on the allowed list: ${host}`);
  }
  const started = await fetch(API, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "http",
      target: host,
      locations: [{ magic: options.from, limit: options.probes }],
      measurementOptions: {
        protocol: "HTTPS",
        request: { method: "GET", path, ...(query ? { query } : {}) },
      },
    }),
  });
  const body: unknown = await started.json();
  const made = created.safeParse(body);
  if (!started.ok || !made.success) {
    throw new Error(`Globalping answered ${started.status}: ${JSON.stringify(body)}`);
  }
  const id = made.data.id;

  // Each second for the first ten, then each three, for at most about 90 seconds: under the 50
  // requests a Worker on the Free plan may make for one request.
  let done = measurement.parse({ status: "in-progress", results: [] });
  for (let tries = 0; tries < 37 && done.status === "in-progress"; tries += 1) {
    await new Promise((wait) => setTimeout(wait, tries < 10 ? 1000 : 3000));
    const polled: unknown = await (await fetch(`${API}/${id}`)).json();
    done = measurement.parse(polled);
  }

  return {
    measurement: id,
    site: host,
    from: options.from,
    path: options.path,
    status: done.status,
    results: done.results.map(({ probe, result }) => {
      const headerOf = (name: string) => {
        const value = result.headers?.[name];
        return (Array.isArray(value) ? value[0] : value) ?? "";
      };
      const ray = headerOf("cf-ray");
      const rayColo = ray.split("-").pop() ?? "";
      const raw = result.rawBody ?? "";
      const colo = coloOf(raw);
      return {
        city: probe.city,
        country: probe.country,
        network: probe.network,
        asn: probe.asn,
        status: result.status,
        error: result.status === "finished" ? "" : (result.rawOutput ?? ""),
        httpStatus: result.statusCode ?? null,
        totalMs: result.timings?.total ?? null,
        bodyBytes: raw.length,
        truncated: result.truncated ?? false,
        ray,
        rayColo,
        // A Void site's page cache: HIT, STALE or MISS (step 4).
        isr: headerOf("x-isr-cache"),
        answer: raw.length > 200 ? `${raw.slice(0, 200)}…` : raw,
        colo,
        same: colo !== "" && colo === rayColo,
      };
    }),
  };
}
