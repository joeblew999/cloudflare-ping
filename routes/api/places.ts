// `GET /api/places`: places to test from, or to narrow a list to (src/commands/places.ts), as
// `?q=bang`, `?kind=city`, `?limit=8`. Nothing asked: every place, which the picker loads once
// and searches in the browser with the same code. Open: it spends no tests. Not cached
// whole (Void never caches paths under /api: guide/edge/revalidation.md); quick anyway, since the
// lists behind it are kept in KV (src/sources/lists.ts). The CLI's `places`.
import { defineHandler } from "void";
import { places, placesQuery } from "../../src/commands/places";

export const GET = defineHandler.withValidator({ query: placesQuery })((_c, { query }) =>
  places(query),
);
