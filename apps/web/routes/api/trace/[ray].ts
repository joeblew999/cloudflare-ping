// `GET /api/trace/<ray id>`: Cloudflare's own record of a request (src/commands/trace.ts).
// Signed in only. The CLI's `trace`.
import { defineHandler } from "void";
import { signedInFor } from "../../../src/commands/context";
import { trace, traceParams, traceQuery } from "../../../src/commands/trace";

export const GET = defineHandler.withValidator({ params: traceParams, query: traceQuery })(async (
  c,
  { params, query },
) => {
  signedInFor("trace", c);
  return trace({ ...params, ...query });
});
