// Runs (plan steps 5 and 8): start one, list them, read one with its fetches. Used by the
// commands (src/commands), which the API, the pages and the MCP tools all run.
import { fetches, runPlaces, runs } from "@schema";
import { count, db, desc, eq } from "void/db";
import { logger } from "void/log";
import { probeFrom } from "./globalping";

export type StartRun = {
  target: string;
  from: string;
  probes: number;
  repeat: number;
  background: boolean;
  token?: string;
};

// A new run, and the Globalping test that carries it: probes in `from` call `/run` for it, and
// `/run` records each fetch under it (in the background, if asked: step 5). Each step goes in the
// Worker's logs (Void's logger: `void project logs`; Workers Logs for history), under the run's ID.
export async function startRun(options: StartRun) {
  const id = crypto.randomUUID();
  const log = logger.child({ run: id });
  await db.insert(runs).values({
    id,
    target: options.target,
    fromPlace: options.from,
    probes: options.probes,
    repeat: options.repeat,
    background: options.background,
  });
  const query = new URLSearchParams({ run: id, url: options.target });
  if (options.repeat > 1) {
    query.set("repeat", String(options.repeat));
  }
  if (options.background) {
    query.set("background", "1");
  }
  log.info(
    `Run ${id} starting: ${options.target} from ${options.from}, ${options.probes} probes × ${options.repeat}, ${options.background ? "in the background" : "inline"}`,
  );
  let test;
  try {
    test = await probeFrom({
      from: options.from,
      path: `/run?${query.toString()}`,
      probes: options.probes,
      token: options.token,
      // Kept at once, so a run cut off while its test is out still names it.
      onCreated: async (measurement) => {
        await db.update(runs).set({ measurement }).where(eq(runs.id, id));
      },
    });
  } catch (caught) {
    // The run stays, saying why it never started (its page, `show`), and the caller is told too.
    const error = caught instanceof Error ? caught.message : String(caught);
    log.error(`Run ${id} didn't start: ${error}`);
    await db.update(runs).set({ error }).where(eq(runs.id, id));
    throw caught;
  }
  const reached = test.results.filter((each) => each.status === "finished").length;
  // Probes that never reached us: the run started, but not everywhere it was asked to.
  const missed = test.results.filter((each) => each.status !== "finished");
  if (missed.length > 0) {
    const error = `${missed.length} of ${test.results.length} probes didn't reach us: ${missed
      .map((each) => `${each.city}, ${each.country}: ${each.status} ${each.error.slice(0, 120)}`)
      .join("; ")}`;
    log.error(`Run ${id}: ${error}`);
    await db.update(runs).set({ error }).where(eq(runs.id, id));
  }
  log.info(`Run ${id} started: ${reached} of ${test.results.length} probes reached us`, {
    measurement: test.measurement,
  });
  return { id, expected: reached * options.repeat, test };
}

// The newest runs, each with how many fetches it has recorded.
export async function listRuns(limit = 50) {
  return db
    .select({
      id: runs.id,
      target: runs.target,
      fromPlace: runs.fromPlace,
      probes: runs.probes,
      repeat: runs.repeat,
      background: runs.background,
      measurement: runs.measurement,
      error: runs.error,
      createdAt: runs.createdAt,
      fetches: count(fetches.id),
    })
    .from(runs)
    .leftJoin(fetches, eq(fetches.runId, runs.id))
    .groupBy(runs.id)
    .orderBy(desc(runs.createdAt))
    .limit(limit);
}

// One run and its fetches, in the order they were made, and, for a run everywhere, the data
// centres it expects (src/everywhere.ts); null if there's no such run.
export async function getRun(id: string) {
  const [run] = await db.select().from(runs).where(eq(runs.id, id)).limit(1);
  if (!run) {
    return null;
  }
  const rows = await db.select().from(fetches).where(eq(fetches.runId, id)).orderBy(fetches.id);
  const places = await db
    .select({
      colo: runPlaces.colo,
      country: runPlaces.country,
      city: runPlaces.city,
      measurement: runPlaces.measurement,
      error: runPlaces.error,
    })
    .from(runPlaces)
    .where(eq(runPlaces.runId, id))
    .orderBy(runPlaces.colo);
  return { run, fetches: rows, places };
}
