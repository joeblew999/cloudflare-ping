// The three lists the coverage map is drawn from (plan 2026-11-20-03), each turned from its
// source's answer into what the map needs. Pure functions: no Worker, no cache, so the tests
// and the real-system check (scripts/coverage-check.ts) run them as they are.
// - Globalping's probe list → its probes, by city.
// - Cloudflare's status page → its data centres ("Place - (CODE)").
// - OurAirports' airports.csv → each data centre code's coordinates and country (Cloudflare's
//   codes are airport codes), with five placed by hand.
import { z } from "zod";

export const PROBES_URL = "https://api.globalping.io/v1/probes";
export const DATACENTRES_URL = "https://www.cloudflarestatus.com/api/v2/components.json";
export const AIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv";

export const probeCity = z.object({
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
      country: z.string(),
      state: z.string().nullish(),
      city: z.string(),
      latitude: z.number(),
      longitude: z.number(),
    }),
  }),
);

// Globalping's probes, one entry per city, with how many probes it has. A city is its name in its
// country (and state), so same-named cities elsewhere stay apart. Globalping's own page counts
// names alone, so it shows a few cities fewer.
export function probeCities(body: unknown): Array<ProbeCity> {
  const byCity = new Map<string, ProbeCity>();
  for (const { location } of probeList.parse(body)) {
    const state = location.state ?? null;
    const key = `${location.country}|${state ?? ""}|${location.city}`;
    const found = byCity.get(key);
    if (found) {
      found.probes += 1;
    } else {
      byCity.set(key, {
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

export const place = z.object({ lat: z.number(), lon: z.number(), country: z.string() });
export type Place = z.infer<typeof place>;

// Data centres whose code the airport data doesn't have: an airport that closed or changed its
// code since Cloudflare named the data centre after it. Placed from Cloudflare's own names
// (2026-11-20).
export const HAND_PLACED: Record<string, Place> = {
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
export function airportPlaces(csv: string, codes: Iterable<string>): Record<string, Place> {
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
  const places: Record<string, Place> = {};
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
