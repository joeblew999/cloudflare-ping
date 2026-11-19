// `GET /api/trace/<ray id>`: Cloudflare's own record of a request, from the account's Workers logs
// (src/trace.ts). Signed in only: the logs are of other people's requests. The CLI's
// `probe:trace`, and a request's page (pages/trace).
import { HTTPException } from "hono/http-exception";
import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { env } from "void/env";
import { z } from "zod";
import { traceOf } from "../../../src/trace";

export const GET = defineHandler.withValidator({
  params: z.object({ ray: z.string().regex(/^[0-9a-f]{16}(-[A-Z]{3})?$/) }),
  query: z.object({ minutes: z.coerce.number().int().min(1).max(10_080).optional() }),
})(async (c, { params, query }) => {
  requireAuth(c);
  const token = env.CLOUDFLARE_OBSERVABILITY_TOKEN;
  if (!token) {
    throw new HTTPException(503, {
      message: "Not set up: the app has no CLOUDFLARE_OBSERVABILITY_TOKEN (env.ts)",
    });
  }
  return traceOf(params.ray, query.minutes ?? 60, token);
});
