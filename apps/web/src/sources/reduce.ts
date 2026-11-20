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

// Data centres whose code the airport data doesn't have: an airport that closed or changed its
// code since Cloudflare named the data centre after it. Placed from Cloudflare's own names
// (2026-11-20).
export const HAND_PLACED: Record<string, AirportPlace> = {
  // Berlin, Germany: Tegel, closed in 2020.
  TXL: { lat: 52.5597, lon: 13.2877, country: "DE" },
  // Chișinău, Moldova.
  KIV: { lat: 46.9277, lon: 28.931, country: "MD" },
  // Bishkek, Kyrgyzstan.
  FRU: { lat: 43.0613, lon: 74.4776, country: "KG" },
  // Americana, Brazil.
  QWJ: { lat: -22.739, lon: -47.331, country: "BR" },
  // Jiaxing, China.
  JXG: { lat: 30.746, lon: 120.756, country: "CN" },
};

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

// The coordinates and country of each of these codes, from OurAirports' airports.csv (public
// domain), the first airport with that code. The hand-placed ones are added, and win.
export function airportPlaces(csv: string, codes: Iterable<string>): Record<string, AirportPlace> {
  const wanted = new Set(codes);
  const lines = csv.split("\n");
  const head = csvFields(lines[0] ?? "");
  const column = (name: string) => head.indexOf(name);
  const [iata, lat, lon, country] = [
    column("iata_code"),
    column("latitude_deg"),
    column("longitude_deg"),
    column("iso_country"),
  ];
  const places: Record<string, AirportPlace> = {};
  for (const line of lines.slice(1)) {
    const fields = line.length > 0 ? csvFields(line) : [];
    const code = fields[iata];
    if (code && wanted.has(code) && !(code in places)) {
      places[code] = {
        lat: Number(fields[lat]),
        lon: Number(fields[lon]),
        country: fields[country] ?? "",
      };
    }
  }
  for (const [code, placed] of Object.entries(HAND_PLACED)) {
    if (wanted.has(code)) {
      places[code] = placed;
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

// Country names by code ("TH": "Thailand"), from countries-list.
export function countryNames(body: unknown): Names {
  const countries = z.record(z.string(), z.object({ name: z.string() })).parse(body);
  return Object.fromEntries(Object.entries(countries).map(([code, each]) => [code, each.name]));
}

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
