// One Globalping HTTP test to the deployed probe, from probes in a given place (Globalping's
// "magic" place: a country such as TH, a city, a network), and what came back: the data centre the
// probe's answer names, and the code that ends its `cf-ray` header. Step 1's proof is that the two
// are the same. Run by the app (`POST /api/probe`, plan step 6), not by the machine asking.
// Without a token, Globalping allows 250 tests an hour per IP address; with an account's token,
// 500 (globalping.io/credits, checked 2026-11-19).
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { SITE } from "@cloudflare-ping/shared/site";
import { ALLOWED_HOSTS } from "@cloudflare-ping/shared/targets";

const API = "https://api.globalping.io/v1/measurements";
const LIMITS = "https://api.globalping.io/v1/limits";

const created = z.object({ id: z.string() });
const limits = z.object({
  rateLimit: z.object({
    measurements: z.object({
      create: z.object({
        type: z.string(),
        limit: z.number(),
        remaining: z.number(),
        reset: z.number(),
      }),
    }),
  }),
  credits: z.object({ remaining: z.number() }).nullish(),
});
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
const refusal = z.object({ error: z.object({ message: z.string() }) });

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
// `onCreated`: told the measurement's ID as soon as Globalping makes it, before its results.
export type ProbeOptions = {
  from: string;
  path: string;
  probes: number;
  host?: string;
  token?: string;
  onCreated?: (measurement: string) => Promise<void>;
};

function headersFor(token: string | undefined) {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return headers;
}

// What Globalping says is left of its hourly limit, by its answer's headers.
function quotaOf(response: Response) {
  const read = (name: string) => response.headers.get(`x-ratelimit-${name}`) ?? "?";
  return `${read("remaining")} of ${read("limit")} tests left, resets in ${read("reset")} s`;
}

// Globalping's limit for whoever asks: tests left this hour, by IP address (the Worker's, for
// whichever of Cloudflare's addresses it went out from) or, with a token, by account. Spends no
// test. `GET /api/limits`, the CLI's `limits`, the Runs page.
export async function globalpingLimits(token: string | undefined) {
  const response = await fetch(LIMITS, { headers: headersFor(token) });
  const body: unknown = await response.json().catch(() => null);
  const read = limits.safeParse(body);
  if (!response.ok || !read.success) {
    const refused = refusal.safeParse(body);
    const words = refused.success ? refused.data.error.message : `HTTP ${response.status}`;
    console.error({ message: `Globalping's limits couldn't be read: ${words}` });
    throw new HTTPException(502, { message: `Globalping's limits couldn't be read: ${words}` });
  }
  const create = read.data.rateLimit.measurements.create;
  return {
    by: create.type,
    limit: create.limit,
    remaining: create.remaining,
    resetSeconds: create.reset,
    credits: read.data.credits?.remaining ?? null,
    token: Boolean(token),
  };
}

export async function probeFrom(options: ProbeOptions) {
  const headers = headersFor(options.token);
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
  const body: unknown = await started.json().catch(() => null);
  const made = created.safeParse(body);
  if (!started.ok || !made.success) {
    // Globalping's own words for it (`{ error: { type, message } }`), to the page or the CLI as
    // they are: a refusal (its hourly limit, a place it has no probes in) isn't our failure.
    const refused = refusal.safeParse(body);
    const words = refused.success ? refused.data.error.message : JSON.stringify(body);
    console.error({
      message: `Globalping refused a test (${started.status}): ${words}`,
      quota: quotaOf(started),
      from: options.from,
      path: options.path,
    });
    throw new HTTPException(502, {
      message: `Globalping refused the test (${started.status}): ${words}`,
    });
  }
  const id = made.data.id;
  console.log({
    message: `Globalping test ${id} made, from ${options.from} to ${host}${options.path}`,
    measurement: id,
    quota: quotaOf(started),
  });
  await options.onCreated?.(id);

  // Each second for the first ten, then each three, for at most about 90 seconds: under the 50
  // requests a Worker on the Free plan may make for one request.
  let done = measurement.parse({ status: "in-progress", results: [] });
  for (let tries = 0; tries < 37 && done.status === "in-progress"; tries += 1) {
    await new Promise((wait) => setTimeout(wait, tries < 10 ? 1000 : 3000));
    const response = await fetch(`${API}/${id}`, { headers });
    const polled: unknown = await response.json().catch(() => null);
    const read = measurement.safeParse(polled);
    if (!response.ok || !read.success) {
      const refused = refusal.safeParse(polled);
      const words = refused.success ? refused.data.error.message : `HTTP ${response.status}`;
      console.error({
        message: `Globalping's measurement ${id} couldn't be read: ${words}`,
        measurement: id,
      });
      throw new HTTPException(502, {
        message: `Globalping's measurement ${id} couldn't be read: ${words}`,
      });
    }
    done = read.data;
  }
  console.log({
    message: `Globalping test ${id}: ${done.status}`,
    measurement: id,
    probes: done.results.map(
      ({ probe, result }) =>
        `${probe.city}, ${probe.country}: ${result.status} ${result.statusCode ?? ""} ${
          result.status === "finished" ? "" : (result.rawOutput ?? "").slice(0, 200)
        }`,
    ),
  });

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
