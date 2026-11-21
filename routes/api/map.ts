// `GET /api/map`: a map (the newest, unless `?id=`), open. `POST /api/map`: start a new one,
// signed in only (src/commands/map.ts). The CLI's `map` and `remap`.
import { defineHandler } from "void";
import { runCommand } from "../../src/commands/context";
import { map, remap } from "../../src/commands/map";

export const GET = defineHandler.withValidator({ query: map.definition.input })((c, { query }) =>
  runCommand(c, map, query),
);

export const POST = defineHandler.withValidator({ body: remap.definition.input })((c, { body }) =>
  runCommand(c, remap, body),
);
