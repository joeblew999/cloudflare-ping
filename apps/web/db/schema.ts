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

// The map (plan step 7): which Cloudflare data centres Globalping's probes reach, and what it
// costs to find out. A map is one walk of Globalping's probes, by country or by city: one place
// each, one test each (src/map.ts, queues/map.ts).
export const maps = sqliteTable("maps", {
  id: text("id").primaryKey(),
  // "country": one probe per country; "city": one per city.
  level: text("level").notNull(),
  // How many places it asks about, in how many countries (one queued test each).
  places: integer("places").notNull(),
  countries: integer("countries").notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});

// One probe's answer in a map: where the probe was (as Globalping says), and the data centre its
// `/where` ran in. No data centre when the probe didn't reach it.
export const sightings = sqliteTable(
  "sightings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    mapId: text("map_id")
      .notNull()
      .references(() => maps.id),
    measurement: text("measurement").notNull(),
    country: text("country").notNull(),
    city: text("city").notNull(),
    asn: integer("asn").notNull(),
    network: text("network").notNull(),
    // The probe's result: "finished", or why not.
    status: text("status").notNull(),
    colo: text("colo"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
  },
  (table) => [index("sightings_map_id").on(table.mapId)],
);

// Cloudflare's own list of its data centres (www.cloudflarestatus.com), kept beside the map as
// reference: what a code such as BKK is, and which ones the map hasn't reached.
export const datacentres = sqliteTable("datacentres", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  region: text("region"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
});
