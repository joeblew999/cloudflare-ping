// Places (plan 2026-11-20-04): what a test can run from, and what a list can be narrowed to. One
// search, run by the Worker for `GET /api/places` (and so the CLI and MCP) and by the picker in
// the browser, over the same places from that API: the same matching everywhere. Pure: no
// Worker, no browser, no packages (a place's schema is in place-schema.ts, so the picker doesn't
// load zod). The places themselves, and every name, come from the lists the app reads
// (src/sources): nothing about them is written here.

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

export type { Place } from "./place-schema";
import type { Place } from "./place-schema";

// Lower case, no accents: "Chișinău" is found by "chisinau".
export function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

const wordsOf = (text: string) => text.split(/[\s,()+./-]+/).filter((word) => word !== "");

// Whether two words are at most `limit` typos apart: a letter added, dropped or changed, or two
// next to each other swapped ("thialand" and "thailand" are one apart).
function typosApart(a: string, b: string, limit: number): boolean {
  if (Math.abs(a.length - b.length) > limit) {
    return false;
  }
  let before: Array<number> = [];
  let row = Array.from({ length: b.length + 1 }, (_, at) => at);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min((next[j - 1] ?? 0) + 1, (row[j] ?? 0) + 1, (row[j - 1] ?? 0) + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, (before[j - 2] ?? 0) + 1);
      }
      next.push(best);
    }
    before = row;
    row = next;
  }
  return (row[b.length] ?? limit + 1) <= limit;
}

// How well a place matches what's typed (already folded): lower is better, null when it doesn't.
// An exact code or name; the name's start; a word in the name; what it's within (so "bang"
// finds Dhaka, in Bangladesh); anywhere in the name; last, the name or a word in it a typo or
// two away ("thialand", "bankok").
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
  if (typed.length >= 4) {
    const limit = typed.length >= 7 ? 2 : 1;
    if (
      typosApart(name, typed, limit) ||
      wordsOf(name).some((word) => typosApart(word, typed, limit))
    ) {
      return 5;
    }
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

// A place as a command-line argument: quoted when it has a space ("Bang Khae+TH"), as the pages'
// "the same from a terminal" and the CLI's `places` both print it.
export function asArgument(text: string): string {
  return /^[\w.+,:@/-]+$/.test(text) ? text : `"${text.replaceAll('"', '\\"')}"`;
}
