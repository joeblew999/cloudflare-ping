// One Globalping HTTP test to the deployed probe, from probes in a given place (Globalping's
// "magic" place: a country such as TH, a city, a network), and what came back: the data centre the
// probe's answer names, and the code that ends its `cf-ray` header. Step 1's proof is that the two
// are the same. Run by the app (`POST /api/probe`, plan step 6), not by the machine asking.
// Without a token, Globalping allows 250 tests an hour per IP address; with an account's token,
// 500 (globalping.io/credits, checked 2026-11-19).
// Made in two parts, so a page can make the test, redirect, and wait for it in its loader
// (`makeTest`, then `testResult`); `probeFrom` does both, for the API.
import { HTTPException } from "hono/http-exception";
import { logger } from "void/log";
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
  // What was asked: kept by Globalping with the measurement, so its page can be shown from its ID.
  target: z.string().nullish(),
  locations: z.array(z.object({ magic: z.string().nullish() })).nullish(),
  measurementOptions: z
    .object({
      request: z.object({ path: z.string().nullish(), query: z.string().nullish() }).nullish(),
    })
    .nullish(),
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
export function coloOf(raw: string): string {
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

// Globalping's own words for a refusal (`{ error: { type, message } }`), or its status.
function wordsOf(body: unknown, status: number) {
  const refused = refusal.safeParse(body);
  return refused.success ? refused.data.error.message : `HTTP ${status}`;
}

// Globalping's limit for whoever asks: tests left this hour, by IP address (the Worker's, for
// whichever of Cloudflare's addresses it went out from) or, with a token, by account. Spends no
// test. `GET /api/limits`, the CLI's `limits`, the Runs page.
export async function globalpingLimits(token: string | undefined) {
  const response = await fetch(LIMITS, { headers: headersFor(token) });
  const body: unknown = await response.json().catch(() => null);
  const read = limits.safeParse(body);
  if (!response.ok || !read.success) {
    const words = wordsOf(body, response.status);
    logger.error(`Globalping's limits couldn't be read: ${words}`);
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

// `host`: our own probe (SITE) unless given; another only if `/run` may fetch it too
// (packages/shared/src/targets.ts), to fetch a target directly, as any visitor would (plan step 4).
export type ProbeOptions = {
  from: string;
  path: string;
  probes: number;
  host?: string;
  token?: string;
  // Exact places instead of `from` (the map, src/map.ts): each a country, or a city in one, with
  // how many probes there.
  places?: Array<{ country: string; city?: string; asn?: number; limit: number }>;
};

// Makes the test and answers its measurement's ID, without waiting for it.
export async function makeTest(options: ProbeOptions) {
  // Globalping takes the query string apart from the path.
  const mark = options.path.indexOf("?");
  const path = mark === -1 ? options.path : options.path.slice(0, mark);
  const query = mark === -1 ? "" : options.path.slice(mark + 1);
  const host = options.host ?? SITE;
  if (host !== SITE && !ALLOWED_HOSTS.has(host)) {
    throw new HTTPException(403, { message: `Not on the allowed list: ${host}` });
  }
  const started = await fetch(API, {
    method: "POST",
    headers: headersFor(options.token),
    body: JSON.stringify({
      type: "http",
      target: host,
      locations: options.places ?? [{ magic: options.from, limit: options.probes }],
      measurementOptions: {
        protocol: "HTTPS",
        request: { method: "GET", path, ...(query ? { query } : {}) },
      },
    }),
  });
  const body: unknown = await started.json().catch(() => null);
  const made = created.safeParse(body);
  if (!started.ok || !made.success) {
    // A refusal (its hourly limit, a place it has no probes in) isn't our failure: its words go
    // to the page or the CLI as they are.
    const words = refusal.safeParse(body).success
      ? wordsOf(body, started.status)
      : JSON.stringify(body);
    logger.error(`Globalping refused a test (${started.status}): ${words}`, {
      quota: quotaOf(started),
      from: options.from,
      path: options.path,
    });
    throw new HTTPException(502, {
      message: `Globalping refused the test (${started.status}): ${words}`,
    });
  }
  const id = made.data.id;
  logger.info(`Globalping test ${id} made, from ${options.from} to ${host}${options.path}`, {
    measurement: id,
    quota: quotaOf(started),
  });
  return id;
}

// A test's result, waiting while it's in progress: each second for the first ten, then each
// three, for at most about 90 seconds (37 reads: Globalping finishes well inside that, and the
// account is on Workers Paid, so a request has subrequests to spare). Reading a measurement
// spends no test.
export async function testResult(id: string, token: string | undefined) {
  const headers = headersFor(token);
  let done = measurement.parse({ status: "in-progress", results: [] });
  for (let tries = 0; tries < 37 && done.status === "in-progress"; tries += 1) {
    if (tries > 0) {
      await new Promise((wait) => setTimeout(wait, tries < 10 ? 1000 : 3000));
    }
    const response = await fetch(`${API}/${id}`, { headers });
    const polled: unknown = await response.json().catch(() => null);
    const read = measurement.safeParse(polled);
    if (!response.ok || !read.success) {
      const words = wordsOf(polled, response.status);
      logger.error(`Globalping's measurement ${id} couldn't be read: ${words}`, {
        measurement: id,
      });
      throw new HTTPException(response.status === 404 ? 404 : 502, {
        message: `Globalping's measurement ${id} couldn't be read: ${words}`,
      });
    }
    done = read.data;
  }
  logger.info(`Globalping test ${id}: ${done.status}`, {
    measurement: id,
    probes: done.results.map(
      ({ probe, result }) =>
        `${probe.city}, ${probe.country}: ${result.status} ${result.statusCode ?? ""} ${
          result.status === "finished" ? "" : (result.rawOutput ?? "").slice(0, 200)
        }`,
    ),
  });

  const request = done.measurementOptions?.request;
  const path = `${request?.path ?? ""}${request?.query ? `?${request.query}` : ""}`;
  return {
    measurement: id,
    site: done.target ?? "",
    from: done.locations?.[0]?.magic ?? "",
    path,
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

// Both: make the test, wait for it, and answer what came back. `onCreated` is told the
// measurement's ID as soon as Globalping makes it, before its results.
export async function probeFrom(
  options: ProbeOptions & { onCreated?: (measurement: string) => Promise<void> },
) {
  const id = await makeTest(options);
  await options.onCreated?.(id);
  return testResult(id, options.token);
}
