// `trace`: Cloudflare's own record of a request, from the account's Workers logs (src/trace.ts).
// Signed in only: the logs are of other people's requests. `GET /api/trace/<ray id>` and a
// request's page.
import { HTTPException } from "hono/http-exception";
import { env } from "void/env";
import { z } from "zod";
import { traceOf } from "../trace";

export const traceParams = z.object({ ray: z.string().regex(/^[0-9a-f]{16}(-[A-Z]{3})?$/) });
export const traceQuery = z.object({
  minutes: z.coerce.number().int().min(1).max(10_080).optional(),
});

// 503 when the app has no token to read the logs with: the page says it's not set up.
export function trace({ ray, minutes }: z.infer<typeof traceParams> & z.infer<typeof traceQuery>) {
  const token = env.CLOUDFLARE_OBSERVABILITY_TOKEN;
  if (!token) {
    throw new HTTPException(503, {
      message: "Not set up: the app has no CLOUDFLARE_OBSERVABILITY_TOKEN (env.ts)",
    });
  }
  return traceOf(ray, minutes ?? 60, token);
}
