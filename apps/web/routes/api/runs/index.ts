// `GET /api/runs`: the newest runs (open). `POST /api/runs`: start one, signed in only
// (src/commands). The CLI's `runs` and `run`.
import { defineHandler } from "void";
import { contextOf, signedInFor } from "../../../src/commands/context";
import { input, run } from "../../../src/commands/run";
import { runs } from "../../../src/commands/runs";

export const GET = defineHandler(() => runs());

export const POST = defineHandler.withValidator({ body: input })(async (c, { body }) => {
  signedInFor("run", c);
  return run(body, contextOf(c));
});
