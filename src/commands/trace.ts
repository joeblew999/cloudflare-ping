// `trace`: Cloudflare's own record of a request, from the account's Workers logs (src/trace.ts).
// Signed in only: the logs are of other people's requests. `GET /api/trace/<ray id>`, a
// request's page, and the MCP tool.
import { HTTPException } from "hono/http-exception";
import { env } from "void/env";
import { z } from "zod";
import { traceOf } from "../trace";

export const traceParams = z.object({ ray: z.string().regex(/^[0-9a-f]{16}(-[A-Z]{3})?$/) });
// How far back to look, in minutes: up to a week.
const minutes = z.number().int().min(1).max(10_080);
// In a URL's query it arrives as text.
export const traceQuery = z.object({ minutes: z.coerce.number().pipe(minutes).optional() });
// As a tool's input, a number.
export const traceInput = traceParams.extend({ minutes: minutes.optional() });

// 503 when the app has no token to read the logs with: the page says it's not set up.
export function trace({ ray, minutes: since }: z.infer<typeof traceInput>) {
  const token = env.CLOUDFLARE_OBSERVABILITY_TOKEN;
  if (!token) {
    throw new HTTPException(503, {
      message: "Not set up: the app has no CLOUDFLARE_OBSERVABILITY_TOKEN (env.ts)",
    });
  }
  return traceOf(ray, since ?? 60, token);
}
