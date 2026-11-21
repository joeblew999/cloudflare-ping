// `GET /api/runs`: the newest runs, a page at a time (open). `POST /api/runs`: start one, signed
// in only (src/commands). The CLI's `runs` and `run`.
import { defineHandler } from "void";
import { runCommand } from "../../../src/commands/context";
import { run } from "../../../src/commands/run";
import { runs } from "../../../src/commands/runs";

export const GET = defineHandler.withValidator({ query: runs.definition.input })((c, { query }) =>
  runCommand(c, runs, query),
);

export const POST = defineHandler.withValidator({ body: run.definition.input })((c, { body }) =>
  runCommand(c, run, body),
);
