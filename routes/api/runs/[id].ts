// `GET /api/runs/<id>`: one run and the fetches it has recorded so far (open). The CLI's
// `ping:show` and `ping:run`, and a run's page.
import { HTTPException } from "hono/http-exception";
import { defineHandler } from "void";
import { z } from "zod";
import { getRun } from "../../../src/runs";

export const GET = defineHandler.withValidator({
  params: z.object({ id: z.string().min(1).max(64) }),
})(async (_c, { params }) => {
  const found = await getRun(params.id);
  if (!found) {
    throw new HTTPException(404, { message: `No such run: ${params.id}` });
  }
  return found;
});
