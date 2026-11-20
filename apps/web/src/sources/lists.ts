// The lists the app reads, cached (src/sources/cache.ts), with when each is refreshed (plans
// 2026-11-20-03 and -04):
// - Globalping's probe list: asked "changed?" every five minutes, and at once when a test sees a
//   probe somewhere it doesn't have, or no probe where it does.
// - Cloudflare's data centres: asked every hour, and at once when a test lands in a code it
//   doesn't have.
// - The airport places, and the names for Globalping's codes: only when a code isn't covered yet
//   (airports don't move; names don't change).
// Used by the map (src/map.ts), runs everywhere (src/everywhere.ts), the coverage map
// (src/commands/coverage.ts) and places (src/commands/places.ts).
import type { Place } from "@cloudflare-ping/shared/places";
import { z } from "zod";
import { cachedSource, type Read, type Source } from "./cache";
import { placesOf, type PlacedDatacentre } from "./places";
import {
  AIRPORTS_URL,
  CONTINENTS_URL,
  COUNTRIES_URL,
  DATACENTRES_URL,
  PROBES_URL,
  REGIONS_URL,
  airportPlace,
  airportPlaces,
  cloudflareDatacentres,
  continentNames,
  countryList,
  countryListOf,
  countryNames,
  datacentre,
  names,
  probeIndex,
  probeIndexOf,
  usStateNames,
  type AirportPlace,
  type Datacentre,
  type Names,
  type ProbeIndex,
} from "./reduce";

type Options = { force?: boolean; now?: number };

export const probes = (options?: Options): Promise<Read<ProbeIndex>> =>
  cachedSource(
    {
      key: "lists:v1:probes",
      url: PROBES_URL,
      recheckSeconds: 300,
      schema: probeIndex,
      reduce: async (response) => probeIndexOf(await response.json()),
    },
    options,
  );

export const datacentres = (options?: Options): Promise<Read<Array<Datacentre>>> =>
  cachedSource(
    {
      key: "lists:v1:datacentres",
      url: DATACENTRES_URL,
      recheckSeconds: 3600,
      schema: z.array(datacentre),
      reduce: async (response) => cloudflareDatacentres(await response.json()),
    },
    options,
  );

// A list kept until it doesn't cover a code it's asked for: then read again, once.
async function covering<T extends Record<string, unknown>>(
  source: Source<T>,
  codes: Array<string>,
  now?: number,
): Promise<T> {
  const kept = await cachedSource(source, { now });
  const missing = codes.some((code) => !(code in kept.data));
  return missing && !kept.changed
    ? (await cachedSource(source, { force: true, now })).data
    : kept.data;
}

// Each data centre code's place, from the airport file.
export const airports = (
  codes: Array<string>,
  now?: number,
): Promise<Record<string, AirportPlace>> =>
  covering(
    {
      key: "lists:v1:airport-places",
      url: AIRPORTS_URL,
      recheckSeconds: null,
      schema: z.record(z.string(), airportPlace),
      reduce: async (response) => airportPlaces(await response.text(), codes),
    },
    codes,
    now,
  );

const named =
  (key: string, url: string, reduce: (response: Response) => Promise<Names>) =>
  (codes: Array<string>, now?: number) =>
    covering({ key, url, recheckSeconds: null, schema: names, reduce }, codes, now);

// Names for Globalping's codes: continents ("AS"), countries ("TH"), US states ("US-VA").
export const continents = named("lists:v1:continent-names", CONTINENTS_URL, async (response) =>
  continentNames(await response.json()),
);
// Countries: each one's name and continent, kept until a code isn't covered.
export const countries = (codes: Array<string>, now?: number) =>
  covering(
    {
      key: "lists:v2:countries",
      url: COUNTRIES_URL,
      recheckSeconds: null,
      schema: countryList,
      reduce: async (response) => countryListOf(await response.json()),
    },
    codes,
    now,
  );
export const states = named("lists:v1:state-names", REGIONS_URL, async (response) =>
  usStateNames(await response.text()),
);

// Cloudflare's data centres, each with its place.
export async function placedDatacentres(): Promise<
  Array<PlacedDatacentre & { lat: number | null; lon: number | null }>
> {
  const { data: centres } = await datacentres();
  const placed = await airports(centres.map((each) => each.code));
  return centres.map((each) => ({
    ...each,
    lat: placed[each.code]?.lat ?? null,
    lon: placed[each.code]?.lon ?? null,
    country: placed[each.code]?.country ?? null,
  }));
}

const unique = (codes: Array<string>) => [...new Set(codes)];

// Every place: Globalping's, named, and Cloudflare's data centres.
export async function allPlaces(): Promise<Array<Place>> {
  const [{ data: index }, centres] = await Promise.all([probes(), placedDatacentres()]);
  const [continentNamed, countryNamed, stateNamed] = await Promise.all([
    continents(unique(index.cities.map((each) => each.continent))),
    countries(unique(index.cities.map((each) => each.country))),
    states(
      unique(index.cities.flatMap((each) => (each.state ? [`${each.country}-${each.state}`] : []))),
    ),
  ]);
  return placesOf({
    probes: index,
    continents: continentNamed,
    countries: countryNames(countryNamed),
    states: stateNamed,
    datacentres: centres,
  });
}

// What a test saw, for the lists: where its probes were and which data centres they landed in. A
// place the probe list doesn't have, or no probe for a place it does, re-reads the probe list; a
// data centre code Cloudflare's list doesn't have re-reads that, and its places.
export async function noticed(seen: {
  places: Array<{ country: string; city: string }>;
  colos: Array<string>;
  unanswered?: number;
}) {
  const [index, centres] = await Promise.all([probes(), datacentres()]);
  const known = new Set(index.data.cities.map((each) => `${each.country}|${each.city}`));
  if (
    (seen.unanswered ?? 0) > 0 ||
    seen.places.some((each) => !known.has(`${each.country}|${each.city}`))
  ) {
    await probes({ force: true });
  }
  const codes = new Set(centres.data.map((each) => each.code));
  if (seen.colos.some((colo) => colo !== "" && !codes.has(colo))) {
    const fresh = await datacentres({ force: true });
    await airports(fresh.data.map((each) => each.code));
  }
}
