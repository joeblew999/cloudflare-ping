// `GET /api/coverage`: the geographical coverage map's data (src/commands/coverage.ts): all of
// Cloudflare's data centres, placed, and all of Globalping's probes by city. Open: it spends no
// tests. `?country=TH`: one country. Not cached whole (Void never caches paths under /api:
// guide/edge/revalidation.md); quick anyway, since the lists behind it are kept in KV.
// The CLI's `coverage`.
import { defineHandler } from "void";
import { coverage, coverageFilter } from "../../src/commands/coverage";

export const GET = defineHandler.withValidator({ query: coverageFilter })((_c, { query }) =>
  coverage(query),
);
