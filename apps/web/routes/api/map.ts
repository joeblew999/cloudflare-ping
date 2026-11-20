// `GET /api/map`: a map (the newest, unless `?id=`), open. `POST /api/map`: start a new one,
// signed in only (src/commands/map.ts). The CLI's `map` and `remap`.
import { defineHandler } from "void";
import { requireAuth } from "void/auth";
import { map, mapQuery, remap, remapInput } from "../../src/commands/map";

export const GET = defineHandler.withValidator({ query: mapQuery })((_c, { query }) => map(query));

export const POST = defineHandler.withValidator({ body: remapInput })(async (c, { body }) => {
  requireAuth(c);
  return remap(body);
});
