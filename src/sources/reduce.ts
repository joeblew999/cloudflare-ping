// The lists the app reads (plans 2026-11-20-03 and -04), each turned from its source's answer
// into what the app needs. Pure functions: no Worker, no cache, so the tests and the real-system
// check (scripts/coverage-check.ts) run them as they are.
// - Globalping's probe list → its probes, by city, and its networks.
// - Cloudflare's status page → its data centres ("Place - (CODE)").
// - OurAirports' airports.csv → each data centre code's coordinates and country (Cloudflare's
//   codes are airport codes), with five placed by hand.
// - Names for Globalping's codes, which its list doesn't spell out: continents and countries
//   from countries-list (the list Globalping itself checks locations against), US states from
//   OurAirports' regions.csv.
import { z } from "zod";

export const PROBES_URL = "https://api.globalping.io/v1/probes";
export const DATACENTRES_URL = "https://www.cloudflarestatus.com/api/v2/components.json";
export const AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";
export const CONTINENTS_URL = "https://cdn.jsdelivr.net/npm/countries-list@3/continents.min.json";
export const COUNTRIES_URL = "https://cdn.jsdelivr.net/npm/countries-list@3/countries.min.json";
export const REGIONS_URL = "https://davidmegginson.github.io/ourairports-data/regions.csv";

export const probeCity = z.object({
  // Globalping's continent code ("AS") and UN region ("South-eastern Asia").
  continent: z.string(),
  region: z.string(),
  country: z.string(),
  // The US state (Globalping gives one only there): Springfield, Missouri, and Springfield,
  // Virginia, are two places.
  state: z.string().nullable(),
  city: z.string(),
  lat: z.number(),
  lon: z.number(),
  probes: z.number(),
});
export type ProbeCity = z.infer<typeof probeCity>;

const probeList = z.array(
  z.object({
    location: z.object({
      continent: z.string(),
      region: z.string(),
      country: z.string(),
      state: z.string().nullish(),
      city: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      asn: z.number(),
      network: z.string(),
    }),
  }),
);

export const probeNetwork = z.object({
  // Globalping's name for it ("Amazon.com"), and the AS numbers probes in it are on.
  name: z.string(),
  asns: z.array(z.number()),
  probes: z.number(),
});
export type ProbeNetwork = z.infer<typeof probeNetwork>;

export const probeIndex = z.object({
  cities: z.array(probeCity),
  networks: z.array(probeNetwork),
});
export type ProbeIndex = z.infer<typeof probeIndex>;

// Globalping's probes, by city and by network: everything else (continents, regions, countries,
// states) is counted from the cities.
export function probeIndexOf(body: unknown): ProbeIndex {
  const probes = probeList.parse(body);
  return { cities: probeCities(probes), networks: probeNetworks(probes) };
}

// One entry per city, with how many probes it has. A city is its name in its country (and state),
// so same-named cities elsewhere stay apart. Globalping's own page counts names alone, so it shows
// a few cities fewer.
function probeCities(probes: z.infer<typeof probeList>): Array<ProbeCity> {
  const byCity = new Map<string, ProbeCity>();
  for (const { location } of probes) {
    const state = location.state ?? null;
    const key = `${location.country}|${state ?? ""}|${location.city}`;
    const found = byCity.get(key);
    if (found) {
      found.probes += 1;
    } else {
      byCity.set(key, {
        continent: location.continent,
        region: location.region,
        country: location.country,
        state,
        city: location.city,
        lat: location.latitude,
        lon: location.longitude,
        probes: 1,
      });
    }
  }
  return [...byCity.values()].sort(
    (a, b) =>
      a.country.localeCompare(b.country) ||
      a.city.localeCompare(b.city) ||
      (a.state ?? "").localeCompare(b.state ?? ""),
  );
}

function probeNetworks(probes: z.infer<typeof probeList>): Array<ProbeNetwork> {
  const byName = new Map<string, { asns: Set<number>; probes: number }>();
  for (const { location } of probes) {
    const found = byName.get(location.network) ?? { asns: new Set<number>(), probes: 0 };
    found.asns.add(location.asn);
    found.probes += 1;
    byName.set(location.network, found);
  }
  return [...byName]
    .map(([name, each]) => ({
      name,
      asns: [...each.asns].sort((a, b) => a - b),
      probes: each.probes,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const datacentre = z.object({
  code: z.string(),
  name: z.string(),
  region: z.string().nullable(),
});
export type Datacentre = z.infer<typeof datacentre>;

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

// Cloudflare's data centres, from its status page. A data centre is named "Place - (CODE)"
// ("Bangkok, Thailand - (BKK)", "Hong Kong - (HKG)"), under a region such as Asia. Some services
// carry a code in brackets too ("Data Loss Prevention (DLP)"), without the " - ".
export function cloudflareDatacentres(body: unknown): Array<Datacentre> {
  const all = components.parse(body).components;
  const regions = new Map(all.filter((each) => each.group).map((each) => [each.id, each.name]));
  return all
    .flatMap((each) => {
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
    })
    .sort((a, b) => a.code.localeCompare(b.code));
}

export const airportPlace = z.object({ lat: z.number(), lon: z.number(), country: z.string() });
export type AirportPlace = z.infer<typeof airportPlace>;

// One line of a CSV file, by its quoted fields ("a","b ""c""",,1.5).
function csvFields(line: string) {
  const fields: Array<string> = [];
  let field = "";
  let quoted = false;
  for (let at = 0; at < line.length; at += 1) {
    const char = line[at];
    if (quoted) {
      if (char === '"' && line[at + 1] === '"') {
        field += '"';
        at += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      fields.push(field);
      field = "";
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

// Letters as a name is written without accents, in lower case: "Chișinău" and "Chişinău" (two
// different s's) are both "chisinau".
const plain = (words: string) =>
  words
    .normalize("NFD")
    .replaceAll(/\p{Diacritic}/gu, "")
    .toLowerCase();

// Where each data centre is, from OurAirports' airports.csv (public domain), by the first of:
// 1. its code, as an airport's code today (BKK);
// 2. its code among an airport's old names (the `keywords` column): an airport that closed or
//    changed its code since Cloudflare named the data centre after it (TXL: Tegel, closed 2020;
//    FRU: Manas, now BSZ);
// 3. the city in Cloudflare's own name ("Jiaxing, China"), as an airport with scheduled flights
//    named after it or serving it, when all such airports are in one country.
// Nothing typed in by hand; a data centre none of these finds stays unplaced (`totals.unplaced`).
export function airportPlaces(
  csv: string,
  centres: ReadonlyArray<{ code: string; name: string }>,
): Record<string, AirportPlace> {
  const wanted = new Set(centres.map((each) => each.code));
  const cities = new Map(
    centres.map((each) => [each.code, plain(each.name.split(",")[0]?.trim() ?? "")]),
  );
  const lines = csv.split("\n");
  const head = csvFields(lines[0] ?? "");
  const column = (name: string) => head.indexOf(name);
  const [iata, keywords, name, municipality, scheduled, lat, lon, country] = [
    column("iata_code"),
    column("keywords"),
    column("name"),
    column("municipality"),
    column("scheduled_service"),
    column("latitude_deg"),
    column("longitude_deg"),
    column("iso_country"),
  ];
  const byCode: Record<string, AirportPlace> = {};
  const byOldCode: Record<string, AirportPlace> = {};
  const byCity = new Map<string, Array<AirportPlace>>();
  for (const line of lines.slice(1)) {
    if (line.length === 0) {
      continue;
    }
    const fields = csvFields(line);
    const place = () => ({
      lat: Number(fields[lat]),
      lon: Number(fields[lon]),
      country: fields[country] ?? "",
    });
    const code = fields[iata];
    if (code && wanted.has(code) && !(code in byCode)) {
      byCode[code] = place();
    }
    for (const old of (fields[keywords] ?? "").split(",").map((each) => each.trim())) {
      if (wanted.has(old) && !(old in byOldCode)) {
        byOldCode[old] = place();
      }
    }
    if (fields[scheduled] === "yes") {
      const where = plain(`${fields[name] ?? ""} ${fields[municipality] ?? ""}`);
      for (const [wantedCode, city] of cities) {
        if (city && where.includes(city)) {
          byCity.set(wantedCode, [...(byCity.get(wantedCode) ?? []), place()]);
        }
      }
    }
  }
  const places: Record<string, AirportPlace> = {};
  for (const code of wanted) {
    const named = byCity.get(code) ?? [];
    const inOneCountry = new Set(named.map((each) => each.country)).size === 1;
    const found = byCode[code] ?? byOldCode[code] ?? (inOneCountry ? named[0] : undefined);
    if (found) {
      places[code] = found;
    }
  }
  return places;
}

// Names, by code.
export const names = z.record(z.string(), z.string());
export type Names = z.infer<typeof names>;

// Continent names by Globalping's codes ("AS": "Asia"), from countries-list.
export function continentNames(body: unknown): Names {
  return names.parse(body);
}

// Each country by code, with its name and continent ("TH": Thailand, in "AS"), from
// countries-list: the coverage table groups countries by continent with it.
export const countryList = z.record(
  z.string(),
  z.object({ name: z.string(), continent: z.string() }),
);
export type CountryList = z.infer<typeof countryList>;
export function countryListOf(body: unknown): CountryList {
  const countries = z
    .record(z.string(), z.object({ name: z.string(), continent: z.string() }))
    .parse(body);
  return Object.fromEntries(
    Object.entries(countries).map(([code, each]) => [
      code,
      { name: each.name, continent: each.continent },
    ]),
  );
}

// Just the names, by code ("TH": "Thailand").
export const countryNames = (list: CountryList): Names =>
  Object.fromEntries(Object.entries(list).map(([code, each]) => [code, each.name]));

// US state names by Globalping's code for them ("US-VA": "Virginia"), from OurAirports'
// regions.csv (Globalping names states only in the US).
export function usStateNames(csv: string): Names {
  const lines = csv.split("\n");
  const head = csvFields(lines[0] ?? "");
  const [code, name, country] = [
    head.indexOf("code"),
    head.indexOf("name"),
    head.indexOf("iso_country"),
  ];
  const found: Names = {};
  for (const line of lines.slice(1)) {
    const fields = line.length > 0 ? csvFields(line) : [];
    const each = fields[code];
    if (each && fields[country] === "US" && fields[name]) {
      found[each] = fields[name];
    }
  }
  return found;
}
