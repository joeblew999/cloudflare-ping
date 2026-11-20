// The map (plan step 7): which Cloudflare data centres Globalping's probes reach, and what it
// costs to find out. A map walks Globalping's probe list (one free call) by country or by city,
// one place each. Each country is one queued message (queues/map.ts), which sends one test to
// `/where` from one probe in each of its places, and keeps each answer as a sighting
// (db/schema.ts). Cloudflare's own list of data centres is kept beside it as reference.
import { datacentres, maps, sightings } from "@schema";
import { HTTPException } from "hono/http-exception";
import { and, count, db, desc, eq, isNotNull, isNull, sql } from "void/db";
import { env } from "void/env";
import { logger } from "void/log";
import { queues } from "void/queues";
import { z } from "zod";
import { globalpingLimits, makeTest, testResult } from "./globalping";

const PROBES = "https://api.globalping.io/v1/probes";
const STATUS = "https://www.cloudflarestatus.com/api/v2/components.json";
// Places per test: Globalping takes many locations in one test; kept small enough that one test
// stays well inside a queue consumer's request.
const PER_TEST = 50;

export type Level = "country" | "city";
export type Place = { country: string; city?: string };
export type MapMessage = { mapId: string; country: string; places: Array<Place> };

const probeList = z.array(
  z.object({ location: z.object({ country: z.string(), city: z.string() }) }),
);

// The places to ask about, by country: one per country, or one per city where Globalping has a
// probe. `only`: these countries (ISO codes), to try a map small.
export async function placesFor(level: Level, only?: Array<string>) {
  const response = await fetch(PROBES);
  const read = probeList.safeParse(await response.json().catch(() => null));
  if (!response.ok || !read.success) {
    throw new HTTPException(502, {
      message: `Globalping's probe list couldn't be read (HTTP ${response.status})`,
    });
  }
  const wanted = only && only.length > 0 ? new Set(only.map((each) => each.toUpperCase())) : null;
  const byCountry = new Map<string, Set<string>>();
  for (const { location } of read.data) {
    if (wanted && !wanted.has(location.country)) {
      continue;
    }
    const cities = byCountry.get(location.country) ?? new Set<string>();
    cities.add(location.city);
    byCountry.set(location.country, cities);
  }
  return [...byCountry]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([country, cities]) => ({
      country,
      places:
        level === "country"
          ? [{ country }]
          : [...cities].sort().map((city): Place => ({ country, city })),
    }));
}

const components = z.object({
  components: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      group: z.boolean().nullish(),
      group_id: z.string().nullish(),
    }),
  ),
});

// Cloudflare's own list of its data centres, from its status page: "Bangkok, Thailand - (BKK)",
// under a region such as Asia. Kept up to date at each map's start.
export async function refreshDatacentres() {
  const response = await fetch(STATUS);
  const read = components.safeParse(await response.json().catch(() => null));
  if (!response.ok || !read.success) {
    logger.warn("Cloudflare's list of data centres couldn't be read", { status: response.status });
    return 0;
  }
  const regions = new Map(
    read.data.components.filter((each) => each.group).map((each) => [each.id, each.name]),
  );
  const rows = read.data.components.flatMap((each) => {
    // A data centre is named "Place - (CODE)" ("Bangkok, Thailand - (BKK)", "Hong Kong - (HKG)").
    // Some services carry a code in brackets too ("Data Loss Prevention (DLP)"), without the " - ".
    const code = /\s-\s\(([A-Z]{3})\)\s*$/.exec(each.name)?.[1];
    return code
      ? [
          {
            code,
            name: each.name.replace(/\s*-\s*\([A-Z]{3}\)\s*$/, ""),
            region: (each.group_id && regions.get(each.group_id)) || null,
          },
        ]
      : [];
  });
  // D1 takes up to 100 bound values in one statement: 30 rows of three at a time.
  for (let at = 0; at < rows.length; at += 30) {
    await db
      .insert(datacentres)
      .values(rows.slice(at, at + 30))
      .onConflictDoUpdate({
        target: datacentres.code,
        set: {
          name: sql`excluded.name`,
          region: sql`excluded.region`,
          updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
        },
      });
  }
  return rows.length;
}

// A new map: its places, one queued message per country (or per 50 of a country's cities).
export async function startMap(level: Level, only?: Array<string>) {
  const groups = await placesFor(level, only);
  if (groups.length === 0) {
    throw new HTTPException(400, {
      message: `Globalping has no probes in ${only?.join(", ") ?? "any country"}`,
    });
  }
  const id = crypto.randomUUID();
  const places = groups.reduce((total, each) => total + each.places.length, 0);
  await db.insert(maps).values({ id, level, places, countries: groups.length });
  const messages = groups.flatMap(({ country, places: all }) => {
    const chunks = [];
    for (let at = 0; at < all.length; at += PER_TEST) {
      chunks.push({ body: { mapId: id, country, places: all.slice(at, at + PER_TEST) } });
    }
    return chunks;
  });
  for (let at = 0; at < messages.length; at += 100) {
    await queues.map.sendBatch(messages.slice(at, at + 100));
  }
  const known = await refreshDatacentres();
  logger.info(`Map ${id} started: ${places} places in ${groups.length} countries, by ${level}`, {
    map: id,
    messages: messages.length,
    datacentres: known,
  });
  return { id, level, places, countries: groups.length, tests: places };
}

// One queued message's work: one test from one probe in each place, each answer kept. Waits
// (the consumer retries later) when Globalping hasn't that many tests left this hour.
export async function mapPlaces(
  message: MapMessage,
): Promise<{ wait: number } | { answered: number }> {
  const log = logger.child({ map: message.mapId, country: message.country });
  const token = env.GLOBALPING_TOKEN;
  const left = await globalpingLimits(token);
  if (left.remaining < message.places.length) {
    log.info(
      `Waiting: ${message.places.length} tests needed, ${left.remaining} left, more in ${left.resetSeconds} s`,
    );
    return { wait: left.resetSeconds };
  }
  const measurement = await makeTest({
    from: message.country,
    path: "/where",
    probes: message.places.length,
    places: message.places.map((place) => ({ ...place, limit: 1 })),
    token,
  });
  const test = await testResult(measurement, token);
  if (test.results.length > 0) {
    await db.insert(sightings).values(
      test.results.map((each) => ({
        mapId: message.mapId,
        measurement,
        country: each.country,
        city: each.city,
        asn: each.asn,
        network: each.network,
        status: each.status,
        colo: each.status === "finished" && each.colo ? each.colo : null,
      })),
    );
  }
  log.info(
    `${message.country}: ${test.results.length} of ${message.places.length} places answered`,
    { measurement },
  );
  return { answered: test.results.length };
}

// A map (the newest, unless given): how far it got, and the data centres it reached, each with
// how many places and countries reached it.
export async function mapSummary(id?: string) {
  const [map] = id
    ? await db.select().from(maps).where(eq(maps.id, id)).limit(1)
    : await db.select().from(maps).orderBy(desc(maps.createdAt)).limit(1);
  if (!map) {
    return { map: null, tests: 0, missed: 0, countriesDone: 0, reached: [], datacentres: 0 };
  }
  const [totals] = await db
    .select({
      tests: count(),
      countriesDone: sql<number>`count(distinct ${sightings.country})`,
    })
    .from(sightings)
    .where(eq(sightings.mapId, map.id));
  const [missed] = await db
    .select({ count: count() })
    .from(sightings)
    .where(and(eq(sightings.mapId, map.id), isNull(sightings.colo)));
  const reached = await db
    .select({
      colo: sightings.colo,
      name: datacentres.name,
      region: datacentres.region,
      places: count(),
      countries: sql<string>`group_concat(distinct ${sightings.country})`,
    })
    .from(sightings)
    .leftJoin(datacentres, eq(datacentres.code, sightings.colo))
    .where(and(eq(sightings.mapId, map.id), isNotNull(sightings.colo)))
    .groupBy(sightings.colo)
    .orderBy(desc(count()));
  const [known] = await db.select({ count: count() }).from(datacentres);
  return {
    map,
    tests: totals?.tests ?? 0,
    missed: missed?.count ?? 0,
    countriesDone: totals?.countriesDone ?? 0,
    reached,
    datacentres: known?.count ?? 0,
  };
}
