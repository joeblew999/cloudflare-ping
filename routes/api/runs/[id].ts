// `GET /api/runs/<id>`: one run and the fetches it has recorded so far (open,
// src/commands/runs.ts). The CLI's `show` and `run`.
import { defineHandler } from "void";
import { show, showParams } from "../../../src/commands/runs";

export const GET = defineHandler.withValidator({ params: showParams })((_c, { params }) =>
  show(params),
);
