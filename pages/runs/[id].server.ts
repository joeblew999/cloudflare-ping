import { defineHandler, type InferProps } from "void";
import { z } from "zod";
import { getRun } from "../../src/runs";

export type Props = InferProps<typeof loader>;

// The same as `GET /api/runs/<id>` (src/runs.ts).
export const loader = defineHandler.withValidator({
  params: z.object({ id: z.string().min(1).max(64) }),
})(async (c, { params }) => {
  const found = await getRun(params.id);
  if (!found) {
    return c.notFound();
  }
  return found;
});
