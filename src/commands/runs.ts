// `runs` and `show`: the newest runs, and one with its fetches (src/runs.ts). Open, like the
// pages. `GET /api/runs`, `GET /api/runs/<id>`, and the Runs pages' loaders.
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { getRun, listRuns } from "../runs";

export const runs = async () => ({ runs: await listRuns() });

export const showParams = z.object({ id: z.string().min(1).max(64) });

export async function show({ id }: z.infer<typeof showParams>) {
  const found = await getRun(id);
  if (!found) {
    throw new HTTPException(404, { message: `No such run: ${id}` });
  }
  return found;
}
