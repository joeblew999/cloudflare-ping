// Places (plan 2026-11-20-04): what a test can run from, and what a list can be narrowed to. One
// search, run by the Worker for `GET /api/places` (and so the CLI and MCP) and by the picker in
// the browser, over the same places from that API: the same matching everywhere. Pure: no
// Worker, no browser, no packages. The places themselves, and every name, come from the lists
// the app reads (apps/web/src/sources): nothing about them is written here.

export const PLACE_KINDS = [
  "continent",
  "region",
  "country",
  "state",
  "city",
  "network",
  "datacentre",
] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];

// The kinds Globalping can run a test from (a data centre is Cloudflare's, not Globalping's).
export const FROM_KINDS: ReadonlyArray<PlaceKind> = PLACE_KINDS.filter(
  (kind) => kind !== "datacentre",
);

// Each kind's heading, where places are shown in groups.
export const KIND_LABELS: Record<PlaceKind, string> = {
  continent: "Continents",
  region: "Regions",
  country: "Countries",
  state: "US states",
  city: "Cities",
  network: "Networks",
  datacentre: "Cloudflare data centres",
};

export type Place = {
  kind: PlaceKind;
  // What people read: "Bangkok", "Thailand", "Amazon.com", "BKK".
  name: string;
  // Where it is, or what it is, after the name: "Thailand (TH)", "Virginia (US-VA)",
  // "AS14618, AS16509", "Bangkok, Thailand".
  within: string | null;
  // What it's found by exactly: "TH", "US-VA", "AS13335", "BKK".
  codes: Array<string>;
  // What's sent to Globalping as the place to test from (its location "magic"): "TH",
  // "Bangkok+TH", "Ashburn+US-VA", "Amazon.com". A data centre's is its code.
  magic: string;
  // Globalping's probes there (none for a data centre: they're Cloudflare's).
  probes: number;
  // Its country (ISO code), where it has one: for narrowing lists.
  country: string | null;
};

// Lower case, no accents: "Chișinău" is found by "chisinau".
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

const wordsOf = (text: string) => text.split(/[\s,()+./-]+/).filter((word) => word !== "");

// How well a place matches what's typed (already folded): lower is better, null when it doesn't.
// An exact code or name; the name's start; a word in the name; what it's within (so "bang"
// finds Dhaka, in Bangladesh); anywhere in the name.
export function scoreOf(place: Place, typed: string): number | null {
  const name = fold(place.name);
  const codes = place.codes.map(fold);
  if (
    name === typed ||
    codes.includes(typed) ||
    (/^\d+$/.test(typed) && codes.includes(`as${typed}`))
  ) {
    return 0;
  }
  if (name.startsWith(typed)) {
    return 1;
  }
  if (wordsOf(name).some((word) => word.startsWith(typed))) {
    return 2;
  }
  const within = place.within ? fold(place.within) : "";
  if (
    within.startsWith(typed) ||
    wordsOf(within).some((word) => word.startsWith(typed)) ||
    codes.some((code) => code.startsWith(typed))
  ) {
    return 3;
  }
  if (typed.length >= 3 && name.includes(typed)) {
    return 4;
  }
  return null;
}

export type Search = {
  // What's typed; nothing: every place.
  q?: string;
  // Only these kinds; none: every kind.
  kinds?: ReadonlyArray<PlaceKind>;
  // At most this many of each kind (the picker shows 8, as globalping.io does).
  perKind?: number;
  // At most this many in all.
  limit?: number;
};

// The places matching what's typed, best first, then most probes first. Nothing typed and no
// kinds: every place, most probes first.
export function searchPlaces(places: ReadonlyArray<Place>, search: Search = {}): Array<Place> {
  const typed = fold(search.q ?? "");
  const kinds = search.kinds && search.kinds.length > 0 ? new Set(search.kinds) : null;
  const scored: Array<{ place: Place; score: number }> = [];
  for (const place of places) {
    if (kinds && !kinds.has(place.kind)) {
      continue;
    }
    const score = typed === "" ? 0 : scoreOf(place, typed);
    if (score !== null) {
      scored.push({ place, score });
    }
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      b.place.probes - a.place.probes ||
      a.place.name.localeCompare(b.place.name),
  );
  const found: Array<Place> = [];
  const perKind = new Map<PlaceKind, number>();
  for (const { place } of scored) {
    const count = perKind.get(place.kind) ?? 0;
    if (search.perKind !== undefined && count >= search.perKind) {
      continue;
    }
    perKind.set(place.kind, count + 1);
    found.push(place);
    if (search.limit !== undefined && found.length >= search.limit) {
      break;
    }
  }
  return found;
}

// Places in groups by kind, the group with the best match first: how the picker and the CLI show
// them.
export function groupByKind(
  places: ReadonlyArray<Place>,
): Array<{ kind: PlaceKind; places: Array<Place> }> {
  const groups = new Map<PlaceKind, Array<Place>>();
  for (const place of places) {
    groups.set(place.kind, [...(groups.get(place.kind) ?? []), place]);
  }
  return [...groups].map(([kind, each]) => ({ kind, places: each }));
}
