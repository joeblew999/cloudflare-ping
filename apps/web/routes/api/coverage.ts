// `GET /api/coverage`: the geographical coverage map's data (src/commands/coverage.ts): all of
// Cloudflare's data centres, placed, and all of Globalping's probes by city. Open: it spends no
// tests. `?country=TH`: one country. Cached whole for five minutes (Void's ISR), each country apart.
// The CLI's `coverage`.
import { defineHandler } from "void";
import { coverage, coverageFilter } from "../../src/commands/coverage";

export const GET = defineHandler.withValidator({ query: coverageFilter })(async (c, { query }) => {
  c.header("x-revalidate", "300");
  return coverage(query);
});
