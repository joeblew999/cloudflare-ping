// `POST /api/probe`: one Globalping test to the deployed probe, sent by the app, and what came
// back (src/globalping.ts). Signed in only: it spends Globalping tests (plan step 6). `host`, to
// test an allowed target directly instead, as any visitor would (plan step 4).
import { HTTPException } from "hono/http-exception";
import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { env } from "void/env";
import { z } from "zod";
import { probeFrom } from "../../src/globalping";
import { SITE } from "@cloudflare-ping/shared/site";
import { ALLOWED_HOSTS } from "@cloudflare-ping/shared/targets";

export const POST = defineHandler.withValidator({
  body: z.object({
    from: z.string().min(1),
    path: z.string().startsWith("/"),
    probes: z.number().int().min(1).max(10),
    host: z.string().optional(),
  }),
})(async (c, { body }) => {
  requireAuth(c);
  if (body.host && body.host !== SITE && !ALLOWED_HOSTS.has(body.host)) {
    throw new HTTPException(403, { message: `Not on the allowed list: ${body.host}` });
  }
  return probeFrom({ ...body, token: env.GLOBALPING_TOKEN });
});
