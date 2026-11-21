// `places` (plan 2026-11-20-04): find a place to test from, or to narrow a list to. Every place
// comes from the lists the app reads (src/sources/lists.ts: Globalping's probes, named, and
// Cloudflare's data centres), matched by the one search (packages/shared/src/places.ts) the
// picker also runs in the browser. Nothing asked: every place. Open: it spends no tests.
// `GET /api/places`, the CLI and the MCP tool.
import { places as definition } from "@cloudflare-ping/shared/commands";
import { placeSchema } from "@cloudflare-ping/shared/place-schema";
import { searchPlaces, type Place, type PlaceField } from "@cloudflare-ping/shared/places";
import { cursorOf, readCursor } from "void-commands";
import { z } from "zod";
import { allPlaces } from "../sources/lists";
import { implement } from "./context";

export const placesAnswer = z.object({
  places: z.array(placeSchema),
  // Where the next lot starts (pass it as `cursor`), or null when these are the last.
  next: z.string().nullable(),
});

export const places = implement(definition, placesAnswer, async (query) => {
  const typed = (query.q ?? "").trim() !== "";
  const found = searchPlaces(await allPlaces(), {
    q: query.q,
    kinds: query.kind ? [query.kind] : undefined,
  });
  // The best first, a lot at a time: with something typed, 50 unless given; with nothing, every
  // place.
  const at = readCursor(query.cursor);
  const from = typeof at?.from === "number" ? at.from : 0;
  const size = query.limit ?? (typed ? 50 : found.length);
  const shown = found.slice(from, from + size);
  return {
    places: shown,
    next: from + size < found.length ? cursorOf({ from: from + size }) : null,
  };
});

// The places a page's location fields take (PLACE_FIELDS), for its place pickers
// (src/PlacePicker.tsx): every place of their kinds, as `places` answers with nothing asked. A
// loader hands them over deferred, so the page shows at once and its boxes are ready when they
// come (plan 2026-11-21-04). The lists' words when they can't be read, shown in the box instead.
export type PickerPlaces = { ok: true; places: Array<Place> } | { ok: false; error: string };

export async function placesFor(...fields: Array<PlaceField>): Promise<PickerPlaces> {
  try {
    const kinds = fields.flatMap((field) => field.kinds);
    return { ok: true, places: searchPlaces(await allPlaces(), { kinds }) };
  } catch (caught) {
    return { ok: false, error: caught instanceof Error ? caught.message : "Failed" };
  }
}
