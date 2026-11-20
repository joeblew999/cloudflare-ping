// `GET /api/places`: places to test from, or to narrow a list to (src/commands/places.ts), as
// `?q=bang`, `?kind=city`, `?limit=8`. Nothing asked: every place, which the picker loads once
// and searches in the browser with the same code. Open: it spends no tests. Cached whole for five
// minutes (Void's ISR), each query apart. The CLI's `places`.
import { defineHandler } from "void";
import { places, placesQuery } from "../../src/commands/places";

export const GET = defineHandler.withValidator({ query: placesQuery })(async (c, { query }) => {
  c.header("x-revalidate", "300");
  return places(query);
});
