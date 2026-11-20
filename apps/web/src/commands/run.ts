// `run`: start a run (src/runs.ts). Signed in only: it spends a Globalping test. `POST /api/runs`
// and the Runs page's action.
import { HTTPException } from "hono/http-exception";
import { env } from "void/env";
import { z } from "zod";
import { ALLOWED_HOSTS } from "@cloudflare-ping/shared/targets";
import { startRunEverywhere } from "../everywhere";
import { startRun } from "../runs";
import type { CommandContext } from "./context";

export const input = z.object({
  target: z.url({ protocol: /^https$/ }),
  from: z.string().min(1),
  probes: z.number().int().min(1).max(10),
  repeat: z.number().int().min(1).max(5),
  background: z.boolean(),
  // From every data centre the map reached, one probe each (plan step 8), instead of `from` and
  // `probes`; in the background. `at`: only these data centres, to try one first.
  everywhere: z
    .object({
      map: z.string().min(8).max(64).optional(),
      at: z
        .array(z.string().regex(/^[A-Za-z]{3}$/, "A data centre's three-letter code, such as BKK"))
        .max(400)
        .optional(),
    })
    .optional(),
});
export type RunInput = z.infer<typeof input>;

export function run(body: RunInput, context: CommandContext) {
  const host = new URL(body.target).hostname;
  if (!ALLOWED_HOSTS.has(host)) {
    throw new HTTPException(403, { message: `Not on the allowed list: ${host}` });
  }
  if (body.everywhere) {
    return startRunEverywhere({
      target: body.target,
      repeat: body.repeat,
      everywhere: body.everywhere,
    });
  }
  // Seen through even if the page or CLI that asked goes away while the test is out: a client
  // that disconnects can cancel its request's work, unless `waitUntil` holds it (Cloudflare's
  // docs: Workers, "Request cancellation").
  const started = startRun({ ...body, token: env.GLOBALPING_TOKEN });
  context.waitUntil(started.catch(() => undefined));
  return started;
}
