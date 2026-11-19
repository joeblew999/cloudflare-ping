// The newest runs, from the app's API (`GET /api/runs`) with Void's typed fetch: the same call as
// the Runs page and `cloudflare-ping runs`. The docs are served by the app, so it's the same site.
import { fetch } from "void/client";

export async function latestRuns(count: number) {
  const { runs } = await fetch("/api/runs");
  return runs.slice(0, count);
}

export type RunSummary = Awaited<ReturnType<typeof latestRuns>>[number];
