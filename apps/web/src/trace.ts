// Cloudflare's own record of a request (plan step 3): found by its ray ID in the account's Workers
// logs (the events whose `$metadata.rayId` is that ID: the request's own record and its own log
// lines, not every line that mentions the ID, such as a visit to its trace page), through
// Cloudflare's telemetry API, with the app's own token (CLOUDFLARE_OBSERVABILITY_TOKEN,
// env.ts). Which Worker ran it, in which data centre, for a request from where, how it ended, how
// long it took, and how many trace spans it recorded. Only those fields: not the visitor's
// address or headers, which the logs also hold.
import { z } from "zod";
import { ACCOUNT_ID } from "@cloudflare-ping/shared/site";

const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/observability/telemetry/query`;

const event = z.object({
  source: z.object({ message: z.string().optional() }).optional(),
  timestamp: z.number(),
  $metadata: z.object({
    service: z.string().optional(),
    traceId: z.string().optional(),
    // A log line's own words (a request's record has none).
    message: z.string().optional(),
  }),
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
const answer = z.object({
  result: z.object({
    events: z.object({ events: z.array(event) }).optional(),
    traces: z.array(z.unknown()).optional(),
  }),
});

// The events of one request (by its ray ID), or a trace's spans (by its trace ID).
type Find = { rayId: string } | { traceId: string };

async function query(token: string, view: "events" | "traces", find: Find, minutes: number) {
  const [key, value] =
    "rayId" in find ? ["$metadata.rayId", find.rayId] : ["$metadata.traceId", find.traceId];
  const to = Date.now();
  const response = await fetch(API, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      queryId: "adhoc",
      timeframe: { from: to - minutes * 60_000, to },
      view,
      limit: 20,
      parameters: { filters: [{ key, operation: "eq", type: "string", value }] },
    }),
  });
  const body: unknown = await response.json();
  const parsed = answer.safeParse(body);
  if (!response.ok || !parsed.success) {
    throw new Error(
      `Cloudflare answered ${response.status}: ${JSON.stringify(body).slice(0, 300)}`,
    );
  }
  return parsed.data.result;
}

// A ray ID as `cf-ray` shows it ends in its data centre; the logs keep it without.
export const bareRay = (ray: string) => ray.replace(/-[A-Z]{3}$/, "");

export async function traceOf(ray: string, minutes: number, token: string) {
  const found =
    (await query(token, "events", { rayId: bareRay(ray) }, minutes)).events?.events ?? [];
  // The request's own record first, then its log lines, in the order they were written.
  const sorted = [...found].sort(
    (a, b) =>
      Number(Boolean(b.$workers?.event?.request)) - Number(Boolean(a.$workers?.event?.request)) ||
      a.timestamp - b.timestamp,
  );
  const logs = [];
  for (const each of sorted) {
    const cf = each.$workers?.event?.request?.cf;
    const isRequest = Boolean(each.$workers?.event?.request);
    const traceId = each.$metadata.traceId ?? null;
    const spans =
      isRequest && traceId
        ? ((await query(token, "traces", { traceId }, minutes)).traces ?? [])
        : [];
    logs.push({
      kind: isRequest ? ("request" as const) : ("line" as const),
      at: new Date(each.timestamp).toISOString(),
      service: each.$metadata.service ?? null,
      message: each.$metadata.message ?? each.source?.message ?? null,
      colo: cf?.colo ?? null,
      from: cf?.asOrganization ?? null,
      city: cf?.city ?? null,
      country: cf?.country ?? null,
      outcome: each.$workers?.outcome ?? null,
      wallTimeMs: each.$workers?.wallTimeMs ?? null,
      cpuTimeMs: each.$workers?.cpuTimeMs ?? null,
      traceId,
      spans: spans.length,
    });
  }
  return { ray: bareRay(ray), minutes, logs };
}
