// `POST /api/probe`: one Globalping test, made and waited for (src/commands/test.ts). Signed in
// only. The CLI's `test`.
import { defineHandler } from "void";
import { signedInFor } from "../../src/commands/context";
import { input, test } from "../../src/commands/test";

export const POST = defineHandler.withValidator({ body: input })(async (c, { body }) => {
  signedInFor("test", c);
  return test(body);
});
