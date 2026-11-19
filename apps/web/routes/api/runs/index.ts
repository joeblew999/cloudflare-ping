// `GET /api/runs`: the newest runs (open, like the pages). `POST /api/runs`: start one, signed in
// only, since it spends Globalping tests (src/runs.ts). The CLI's `ping:runs` and `ping:run`, and
// the Runs page.
import { HTTPException } from "hono/http-exception";
import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { env } from "void/env";
import { z } from "zod";
import { listRuns, startRun } from "../../../src/runs";
import { ALLOWED_HOSTS } from "@cloudflare-ping/shared/targets";

export const GET = defineHandler(async () => ({ runs: await listRuns() }));

export const POST = defineHandler.withValidator({
  body: z.object({
    target: z.url({ protocol: /^https$/ }),
    from: z.string().min(1),
    probes: z.number().int().min(1).max(10),
    repeat: z.number().int().min(1).max(5),
    background: z.boolean(),
  }),
})(async (c, { body }) => {
  requireAuth(c);
  const host = new URL(body.target).hostname;
  if (!ALLOWED_HOSTS.has(host)) {
    throw new HTTPException(403, { message: `Not on the allowed list: ${host}` });
  }
  // Seen through even if the page or CLI that asked goes away while the test is out: a client
  // that disconnects can cancel its request's work, unless `waitUntil` holds it (Cloudflare's
  // docs: Workers, "Request cancellation").
  const started = startRun({ ...body, token: env.GLOBALPING_TOKEN });
  c.executionCtx.waitUntil(started.catch(() => undefined));
  return started;
});
