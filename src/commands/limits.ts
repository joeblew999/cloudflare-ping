// `limits`: how many Globalping tests the app has left this hour, asked by the Worker itself,
// since it's the Worker's address, or its token, that Globalping counts. With the address the
// Worker went out from, asked in the same request: without a token, that is the address whose
// tests are counted, and Cloudflare's addresses are shared with everyone else's Workers. Spends no
// test. Open. `GET /api/limits`, the Runs page's loader, the MCP tool, and the question asked
// before an MCP call that spends (src/mcp.ts).
import { limits as definition } from "@cloudflare-ping/shared/commands";
import { env } from "void/env";
import { logger } from "void/log";
import { z } from "zod";
import { globalpingLimits } from "../globalping";
import { outboundAddress } from "../outbound";
import { implement } from "./context";

export const limitsAnswer = z.object({
  // Where this request ran, and the address it went out from.
  colo: z.string().nullable(),
  address: z.string().nullable(),
  globalping: z.object({
    // What Globalping counts by: "ip" or "user" (with the app's token).
    by: z.string(),
    limit: z.number(),
    remaining: z.number(),
    resetSeconds: z.number(),
    credits: z.number().nullable(),
    token: z.boolean(),
  }),
});

export const limits = implement(definition, limitsAnswer, async (_input, context) => {
  const [globalping, address] = await Promise.all([
    globalpingLimits(env.GLOBALPING_TOKEN),
    outboundAddress(),
  ]);
  logger.info(
    `Tests: ${globalping.remaining} of ${globalping.limit} left for ${address ?? "?"} in ${context.colo ?? "?"}`,
    { address, colo: context.colo, remaining: globalping.remaining, by: globalping.by },
  );
  return { colo: context.colo, address, globalping };
});
