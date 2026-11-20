// A run everywhere (plan step 8): one probe in each data centre the map reached (src/map.ts), each
// sent to `/run` for the run, which fetches the target from that data centre and records it (in
// the background: step 5). The map says which place's probe reaches which data centre; the
// run's places (`run_places`) are those, one per data centre. They go out on the runs queue
// (queues/runs.ts), 50 places to a Globalping test, waiting out Globalping's hourly limit when
// they must.
import { maps, runPlaces, runs, sightings } from "@schema";
import { HTTPException } from "hono/http-exception";
import { and, db, desc, eq, inArray, isNotNull } from "void/db";
import { env } from "void/env";
import { logger } from "void/log";
import { queues } from "void/queues";
import { globalpingLimits, makeTest, testResult } from "./globalping";

const PER_TEST = 50;

export type Everywhere = {
  // The map to take the places from (the newest unless given).
  map?: string;
  // Only these data centres (BKK, SIN): one first, as the plan's proof asks.
  at?: Array<string>;
};

export type RunPlacesMessage = {
  runId: string;
  target: string;
  repeat: number;
  places: Array<{ id: number; country: string; city: string; asn: number | null }>;
};

// One place for each data centre the map reached: the first of its sightings that reached it.
async function placesFrom(everywhere: Everywhere) {
  const [map] = everywhere.map
    ? await db.select().from(maps).where(eq(maps.id, everywhere.map)).limit(1)
    : await db.select().from(maps).orderBy(desc(maps.createdAt)).limit(1);
  if (!map) {
    throw new HTTPException(400, {
      message: "No map yet to run everywhere from: start one (cloudflare-ping remap)",
    });
  }
  const seen = await db
    .select({
      colo: sightings.colo,
      country: sightings.country,
      city: sightings.city,
      asn: sightings.asn,
    })
    .from(sightings)
    .where(
      and(
        eq(sightings.mapId, map.id),
        isNotNull(sightings.colo),
        ...(everywhere.at && everywhere.at.length > 0
          ? [
              inArray(
                sightings.colo,
                everywhere.at.map((each) => each.toUpperCase()),
              ),
            ]
          : []),
      ),
    )
    .orderBy(sightings.id);
  const byColo = new Map<string, { colo: string; country: string; city: string; asn: number }>();
  for (const each of seen) {
    if (each.colo && !byColo.has(each.colo)) {
      byColo.set(each.colo, {
        colo: each.colo,
        country: each.country,
        city: each.city,
        asn: each.asn,
      });
    }
  }
  const places = [...byColo.values()].sort((a, b) => a.colo.localeCompare(b.colo));
  if (places.length === 0) {
    throw new HTTPException(400, {
      message: everywhere.at?.length
        ? `The map (${map.id}) didn't reach ${everywhere.at.join(", ")}`
        : `The map (${map.id}) hasn't reached any data centre yet`,
    });
  }
  return { map, places };
}

// A new run everywhere: the run, its places, and the queued tests that send its probes.
export async function startRunEverywhere(options: {
  target: string;
  repeat: number;
  everywhere: Everywhere;
}) {
  const { map, places } = await placesFrom(options.everywhere);
  const id = crypto.randomUUID();
  const log = logger.child({ run: id });
  await db.insert(runs).values({
    id,
    target: options.target,
    fromPlace: `everywhere: ${places.length} data centres (map ${map.id.slice(0, 8)})`,
    probes: places.length,
    repeat: options.repeat,
    background: true,
  });
  const rows: Array<{ id: number; country: string; city: string; asn: number | null }> = [];
  // D1 takes up to 100 bound values in one statement: 20 rows of five at a time.
  for (let at = 0; at < places.length; at += 20) {
    const made = await db
      .insert(runPlaces)
      .values(places.slice(at, at + 20).map((place) => ({ runId: id, ...place })))
      .returning({
        id: runPlaces.id,
        country: runPlaces.country,
        city: runPlaces.city,
        asn: runPlaces.asn,
      });
    rows.push(...made);
  }
  const messages = [];
  for (let at = 0; at < rows.length; at += PER_TEST) {
    messages.push({
      body: {
        runId: id,
        target: options.target,
        repeat: options.repeat,
        places: rows.slice(at, at + PER_TEST),
      },
    });
  }
  for (let at = 0; at < messages.length; at += 100) {
    await queues.runs.sendBatch(messages.slice(at, at + 100));
  }
  log.info(
    `Run ${id} everywhere: ${places.length} data centres from map ${map.id}, ${messages.length} tests queued`,
  );
  return {
    id,
    expected: places.length * options.repeat,
    test: null,
    dataCentres: places.length,
  };
}

// One queued message's work: one Globalping test from one probe in each of its places, to
// `/run` for the run. Waits when Globalping hasn't enough tests left this hour.
export async function sendPlaces(
  message: RunPlacesMessage,
): Promise<{ wait: number } | { sent: number }> {
  const log = logger.child({ run: message.runId });
  const token = env.GLOBALPING_TOKEN;
  const left = await globalpingLimits(token);
  if (left.remaining < message.places.length) {
    log.info(
      `Waiting: ${message.places.length} tests needed, ${left.remaining} left, more in ${left.resetSeconds} s`,
    );
    return { wait: left.resetSeconds };
  }
  const query = new URLSearchParams({ run: message.runId, url: message.target, background: "1" });
  if (message.repeat > 1) {
    query.set("repeat", String(message.repeat));
  }
  const measurement = await makeTest({
    from: "everywhere",
    path: `/run?${query.toString()}`,
    probes: message.places.length,
    // The same city and network the map's probe was on.
    places: message.places.map((place) => ({
      country: place.country,
      city: place.city,
      ...(place.asn ? { asn: place.asn } : {}),
      limit: 1,
    })),
    token,
  });
  const ids = message.places.map((place) => place.id);
  await db.update(runPlaces).set({ measurement }).where(inArray(runPlaces.id, ids));
  // Which probes didn't reach `/run`, and why, kept on their places.
  const test = await testResult(measurement, token);
  const open = [...message.places];
  for (const result of test.results) {
    const at = open.findIndex(
      (place) =>
        place.country === result.country &&
        place.city === result.city &&
        (place.asn === null || place.asn === result.asn),
    );
    const place = at === -1 ? undefined : open.splice(at, 1)[0];
    // Not reached (`status`), or reached and refused (`/run` answering other than 200).
    const why =
      result.status !== "finished"
        ? `${result.status}: ${result.error}`
        : result.httpStatus !== 200
          ? `/run answered HTTP ${result.httpStatus ?? "?"} in ${result.rayColo || "?"}: ${result.answer}`
          : null;
    if (place && why) {
      await db
        .update(runPlaces)
        .set({ error: why.slice(0, 300) })
        .where(eq(runPlaces.id, place.id));
    }
  }
  for (const place of open) {
    await db
      .update(runPlaces)
      .set({ error: "Globalping had no probe there this time" })
      .where(eq(runPlaces.id, place.id));
  }
  log.info(`Run ${message.runId}: ${test.results.length} of ${message.places.length} probes sent`, {
    measurement,
  });
  return { sent: test.results.length };
}
