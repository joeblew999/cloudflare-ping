// `GET /api/trace/<ray id>`: Cloudflare's own record of a request (src/commands/trace.ts), the ray
// in the path and `?minutes=` in the query. Signed in only. The CLI's `trace`.
import { defineHandler } from "void";
import { runCommand } from "../../../src/commands/context";
import { trace } from "../../../src/commands/trace";

const { input } = trace.definition;

export const GET = defineHandler.withValidator({
  params: input.pick({ ray: true }),
  query: input.pick({ minutes: true }),
})((c, { params, query }) => runCommand(c, trace, { ...params, ...query }));
