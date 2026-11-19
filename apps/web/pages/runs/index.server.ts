import { defineHandler, type InferProps } from "void";
import { getUser } from "void/auth";
import { listRuns } from "../../src/runs";

export type Props = InferProps<typeof loader>;

// The same list as `GET /api/runs` (src/runs.ts).
export const loader = defineHandler(async () => ({
  email: getUser()?.email ?? null,
  runs: await listRuns(),
}));
