// `limits`: how many Globalping tests the app has left this hour, asked by the Worker itself,
// since it's the Worker's address, or its token, that Globalping counts. With the address the
// Worker went out from, asked in the same request: without a token, that is the address whose
// tests are counted, and Cloudflare's addresses are shared with everyone else's Workers. Spends no
// test. Open. `GET /api/limits` and the Runs page's loader.
import { env } from "void/env";
import { logger } from "void/log";
import { globalpingLimits } from "../globalping";
import { outboundAddress } from "../outbound";
import type { CommandContext } from "./context";

export async function limits(context: CommandContext) {
  const [globalping, address] = await Promise.all([
    globalpingLimits(env.GLOBALPING_TOKEN),
    outboundAddress(),
  ]);
  logger.info(
    `Tests: ${globalping.remaining} of ${globalping.limit} left for ${address ?? "?"} in ${context.colo ?? "?"}`,
    { address, colo: context.colo, remaining: globalping.remaining, by: globalping.by },
  );
  return { colo: context.colo, address, globalping };
}
