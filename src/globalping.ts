// One Globalping HTTP test to the deployed probe, from probes in a given place (Globalping's
// "magic" place: a country such as TH, a city, a network), and what came back: the data centre the
// probe's answer names, and the code that ends its `cf-ray` header. Step 1's proof is that the two
// are the same. Run by the app (`POST /api/probe`, plan step 6), not by the machine asking.
// Without a token, Globalping allows 250 tests an hour per IP address; with an account's token,
// 500 (globalping.io/credits, checked 2026-11-19).
import { z } from "zod";
import { SITE } from "./site";

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
        timings: z.object({ total: z.number().nullish() }).nullish(),
      }),
    }),
  ),
});
const answer = z.object({ colo: z.string() });

export type ProbeOptions = { from: string; path: string; probes: number; token?: string };

export async function probeFrom(options: ProbeOptions) {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.token) {
    headers.set("authorization", `Bearer ${options.token}`);
  }
  const started = await fetch(API, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type: "http",
      target: SITE,
      locations: [{ magic: options.from, limit: options.probes }],
      measurementOptions: { protocol: "HTTPS", request: { method: "GET", path: options.path } },
    }),
  });
  const body: unknown = await started.json();
  const made = created.safeParse(body);
  if (!started.ok || !made.success) {
    throw new Error(`Globalping answered ${started.status}: ${JSON.stringify(body)}`);
  }
  const id = made.data.id;

  // Globalping's HTTP tests take a few seconds; a minute is the most this waits.
  let done = measurement.parse({ status: "in-progress", results: [] });
  for (let tries = 0; tries < 60 && done.status === "in-progress"; tries += 1) {
    await new Promise((wait) => setTimeout(wait, 1000));
    const polled: unknown = await (await fetch(`${API}/${id}`)).json();
    done = measurement.parse(polled);
  }

  return {
    measurement: id,
    site: SITE,
    from: options.from,
    path: options.path,
    status: done.status,
    results: done.results.map(({ probe, result }) => {
      const header = result.headers?.["cf-ray"];
      const ray = (Array.isArray(header) ? header[0] : header) ?? "";
      const rayColo = ray.split("-").pop() ?? "";
      const raw = result.rawBody ?? "";
      let colo = "";
      try {
        const parsed = answer.safeParse(JSON.parse(raw));
        colo = parsed.success ? parsed.data.colo : "";
      } catch {
        colo = "";
      }
      return {
        city: probe.city,
        country: probe.country,
        network: probe.network,
        asn: probe.asn,
        status: result.status,
        httpStatus: result.statusCode ?? null,
        totalMs: result.timings?.total ?? null,
        ray,
        rayColo,
        answer: raw,
        colo,
        same: colo !== "" && colo === rayColo,
      };
    }),
  };
}
