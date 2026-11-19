// Cloudflare's own record of a request (plan step 3): found by its ray ID in the account's Workers
// logs, through Cloudflare's telemetry API, with the app's own token (CLOUDFLARE_OBSERVABILITY_TOKEN,
// env.ts). Which Worker ran it, in which data centre, for a request from where, how it ended, how
// long it took, and how many trace spans it recorded. Only those fields: not the visitor's
// address or headers, which the logs also hold.
import { z } from "zod";
import { ACCOUNT_ID } from "./site";

const API = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/workers/observability/telemetry/query`;

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
const answer = z.object({
  result: z.object({
    events: z.object({ events: z.array(event) }).optional(),
    traces: z.array(z.unknown()).optional(),
  }),
});

async function query(token: string, view: "events" | "traces", needle: string, minutes: number) {
  const to = Date.now();
  const response = await fetch(API, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({
      queryId: "adhoc",
      timeframe: { from: to - minutes * 60_000, to },
      view,
      limit: 20,
      parameters: { needle: { value: needle } },
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
  const found = (await query(token, "events", bareRay(ray), minutes)).events?.events ?? [];
  const logs = [];
  for (const each of found) {
    const cf = each.$workers?.event?.request?.cf;
    const traceId = each.$metadata.traceId ?? null;
    const spans = traceId ? ((await query(token, "traces", traceId, minutes)).traces ?? []) : [];
    logs.push({
      at: new Date(each.timestamp).toISOString(),
      service: each.$metadata.service ?? null,
      message: each.source?.message ?? null,
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
