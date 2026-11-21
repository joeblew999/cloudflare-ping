// `POST /api/probe`: one Globalping test, made and waited for (src/commands/test.ts). Signed in
// only. The CLI's `test`.
import { defineHandler } from "void";
import { runCommand } from "../../src/commands/context";
import { test } from "../../src/commands/test";

export const POST = defineHandler.withValidator({ body: test.definition.input })((c, { body }) =>
  runCommand(c, test, body),
);
