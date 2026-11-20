// The three lists, cached (src/sources/cache.ts), with when each is refreshed (plan
// 2026-11-20-03):
// - Globalping's probe list: asked "changed?" every five minutes, and at once when a test sees a
//   probe somewhere it doesn't have, or no probe where it does.
// - Cloudflare's data centres: asked every hour, and at once when a test lands in a code it
//   doesn't have.
// - The airport places: only when a data centre code isn't placed yet (airports don't move).
// Used by the map (src/map.ts), runs everywhere (src/everywhere.ts) and the coverage map
// (src/commands/coverage.ts).
import { z } from "zod";
import { cachedSource, type Read } from "./cache";
import {
  AIRPORTS_URL,
  DATACENTRES_URL,
  PROBES_URL,
  airportPlaces,
  cloudflareDatacentres,
  datacentre,
  place,
  probeCities,
  probeCity,
  type Datacentre,
  type Place,
  type ProbeCity,
} from "./reduce";

type Options = { force?: boolean; now?: number };

export const probes = (options?: Options): Promise<Read<Array<ProbeCity>>> =>
  cachedSource(
    {
      key: "coverage:v1:probe-cities",
      url: PROBES_URL,
      recheckSeconds: 300,
      schema: z.array(probeCity),
      reduce: async (response) => probeCities(await response.json()),
    },
    options,
  );

export const datacentres = (options?: Options): Promise<Read<Array<Datacentre>>> =>
  cachedSource(
    {
      key: "coverage:v1:datacentres",
      url: DATACENTRES_URL,
      recheckSeconds: 3600,
      schema: z.array(datacentre),
      reduce: async (response) => cloudflareDatacentres(await response.json()),
    },
    options,
  );

const AIRPORTS_KEY = "coverage:v1:airport-places";

// Each data centre code's place. Read again from the airport file only when a code isn't placed
// yet: a new data centre.
export async function places(codes: Array<string>, now?: number): Promise<Record<string, Place>> {
  const read = (force: boolean) =>
    cachedSource(
      {
        key: AIRPORTS_KEY,
        url: AIRPORTS_URL,
        recheckSeconds: null,
        schema: z.record(z.string(), place),
        reduce: async (response) => airportPlaces(await response.text(), codes),
      },
      { force, now },
    );
  const kept = await read(false);
  const missing = codes.filter((code) => !(code in kept.data));
  return missing.length > 0 && !kept.changed ? (await read(true)).data : kept.data;
}

// What a test saw, for the lists: where its probes were and which data centres they landed in. A
// place the probe list doesn't have, or no probe for a place it does, re-reads the probe list; a
// data centre code Cloudflare's list doesn't have re-reads that, and its places.
export async function noticed(seen: {
  places: Array<{ country: string; city: string }>;
  colos: Array<string>;
  unanswered?: number;
}) {
  const [cities, centres] = await Promise.all([probes(), datacentres()]);
  const known = new Set(cities.data.map((each) => `${each.country}|${each.city}`));
  if (
    (seen.unanswered ?? 0) > 0 ||
    seen.places.some((each) => !known.has(`${each.country}|${each.city}`))
  ) {
    await probes({ force: true });
  }
  const codes = new Set(centres.data.map((each) => each.code));
  if (seen.colos.some((colo) => colo !== "" && !codes.has(colo))) {
    const fresh = await datacentres({ force: true });
    await places(fresh.data.map((each) => each.code));
  }
}
