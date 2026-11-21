// `trace`: Cloudflare's own record of a request, from the account's Workers logs (src/trace.ts).
// Signed in only: the logs are of other people's requests. `GET /api/trace/<ray id>`, a
// request's page, and the MCP tool.
import { trace as definition } from "@cloudflare-ping/shared/commands";
import { env } from "void/env";
import { z } from "zod";
import { fail } from "void-commands/server";
import { traceOf } from "../trace";
import { implement } from "./context";

export const traceAnswer = z.object({
  ray: z.string(),
  minutes: z.number(),
  logs: z.array(
    z.object({
      // The request itself, or a line logged while it ran.
      kind: z.enum(["request", "line"]),
      at: z.string(),
      service: z.string().nullable(),
      message: z.string().nullable(),
      colo: z.string().nullable(),
      from: z.string().nullable(),
      city: z.string().nullable(),
      country: z.string().nullable(),
      outcome: z.string().nullable(),
      wallTimeMs: z.number().nullable(),
      cpuTimeMs: z.number().nullable(),
      traceId: z.string().nullable(),
      spans: z.number(),
    }),
  ),
});

// Not set up when the app has no token to read the logs with: the page says so.
export const trace = implement(definition, traceAnswer, ({ ray, minutes }) => {
  const token = env.CLOUDFLARE_OBSERVABILITY_TOKEN;
  if (!token) {
    fail("not_set_up", "Not set up: the app has no CLOUDFLARE_OBSERVABILITY_TOKEN (env.ts)");
  }
  return traceOf(ray, minutes ?? 60, token);
});
