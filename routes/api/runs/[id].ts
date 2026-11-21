// `GET /api/runs/<id>`: one run and the fetches it has recorded so far (open,
// src/commands/runs.ts). The CLI's `show` and `run`.
import { defineHandler } from "void";
import { runCommand } from "../../../src/commands/context";
import { show } from "../../../src/commands/runs";

export const GET = defineHandler.withValidator({ params: show.definition.input })((c, { params }) =>
  runCommand(c, show, params),
);
