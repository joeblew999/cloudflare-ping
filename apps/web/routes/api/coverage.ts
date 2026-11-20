// `GET /api/coverage`: the geographical coverage map's data (src/commands/coverage.ts): all of
// Cloudflare's data centres, placed, and all of Globalping's probes by city. Open: it spends no
// tests. Cached whole for five minutes (Void's ISR). The CLI's `coverage`.
import { defineHandler } from "void";
import { coverage } from "../../src/commands/coverage";

export const GET = defineHandler(async (c) => {
  c.header("x-revalidate", "300");
  return coverage();
});
