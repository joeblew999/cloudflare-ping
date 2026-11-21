// `GET /api/places`: places to test from, or to narrow a list to (src/commands/places.ts), as
// `?q=bang`, `?kind=city`, `?limit=8`, a lot at a time (`?cursor=`, from the last answer's `next`).
// Nothing asked: every place. Open: it spends no tests. Not cached whole (Void never caches paths
// under /api: guide/edge/revalidation.md); quick anyway, since the lists behind it are kept in KV
// (src/sources/lists.ts). The CLI's `places`.
import { defineHandler } from "void";
import { runCommand } from "../../src/commands/context";
import { places } from "../../src/commands/places";

export const GET = defineHandler.withValidator({ query: places.definition.input })((c, { query }) =>
  runCommand(c, places, query),
);
