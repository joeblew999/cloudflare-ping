// `POST /api/probe`: one Globalping test to the deployed probe, sent by the app, and what came
// back (src/globalping.ts). Signed in only: it spends Globalping tests (plan step 6).
import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { env } from "void/env";
import { z } from "zod";
import { probeFrom } from "../../src/globalping";

export const POST = defineHandler.withValidator({
  body: z.object({
    from: z.string().min(1),
    path: z.string().startsWith("/"),
    probes: z.number().int().min(1).max(10),
  }),
})(async (c, { body }) => {
  requireAuth(c);
  return probeFrom({ ...body, token: env.GLOBALPING_TOKEN });
});
