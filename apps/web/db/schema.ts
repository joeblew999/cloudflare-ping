// The app's database (D1). Plan step 5: a probe records its own results, so a run isn't held to
// what one Globalping test can carry back (15 seconds, 10,000 bytes: step 2).
import { sql } from "void/db";
import { index, integer, sqliteTable, text } from "void/schema-d1";

// A run: one or many fetches of a target, recorded as they happen. Its ID is random and
// unguessable, and `/run` records only into a run that exists, so `/run` being public doesn't let
// anyone write into the database.
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  target: text("target").notNull(),
  // How it was started (`POST /api/runs`): from where (Globalping's place), with how many probes,
  // how many fetches each, and whether in the background; and the Globalping measurement that
  // carried it. Empty for a run made by hand (step 5's).
  fromPlace: text("from_place"),
  probes: integer("probes"),
  repeat: integer("repeat"),
  background: integer("background", { mode: "boolean" }),
  measurement: text("measurement"),
  // Why it never started, if it didn't (Globalping refusing the test, say).
  error: text("error"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

// One fetch by `/run`: where our Worker ran, and what the target answered.
export const fetches = sqliteTable(
  "fetches",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id),
    // Our request's `cf-ray`: the one the Globalping test that brought it saw.
    ray: text("ray").notNull(),
    // Where our Worker ran.
    colo: text("colo"),
    // Which of the request's fetches (`&repeat`), from 1.
    attempt: integer("attempt").notNull(),
    target: text("target").notNull(),
    status: integer("status").notNull(),
    targetRay: text("target_ray"),
    // Where the target ran: the end of its `cf-ray`.
    targetColo: text("target_colo"),
    // A Void target's page cache: HIT, STALE or MISS.
    isr: text("isr"),
    ms: integer("ms").notNull(),
    bytes: integer("bytes").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [index("fetches_run_id").on(table.runId)],
);
