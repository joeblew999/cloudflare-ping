// `GET /api/limits`: how many Globalping tests the app has left this hour, asked by the Worker
// itself (src/globalping.ts), since it's the Worker's address, or its token, that Globalping
// counts. Spends no test. Open, like the runs. The CLI's `limits`, the Runs page.
import { defineHandler } from "void";
import { env } from "void/env";
import { globalpingLimits } from "../../src/globalping";

export const GET = defineHandler(async (c) => {
  const colo = c.req.raw.cf?.colo;
  return {
    colo: typeof colo === "string" ? colo : null,
    globalping: await globalpingLimits(env.GLOBALPING_TOKEN),
  };
});
