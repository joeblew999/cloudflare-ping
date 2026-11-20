// `places` (plan 2026-11-20-04): find a place to test from, or to narrow a list to. Every place
// comes from the lists the app reads (src/sources/lists.ts: Globalping's probes, named, and
// Cloudflare's data centres), matched by the one search (packages/shared/src/places.ts) the
// picker also runs in the browser. Nothing asked: every place, as the picker loads them. Open: it
// spends no tests. `GET /api/places`, the CLI and the MCP tool.
import { PLACE_KINDS, searchPlaces } from "@cloudflare-ping/shared/places";
import { z } from "zod";
import { allPlaces } from "../sources/lists";

export const placesQuery = z.object({
  // What's typed: "bang", "TH", "AS13335", "virginia".
  q: z.string().max(100).optional(),
  // Only places of this kind.
  kind: z.enum(PLACE_KINDS).optional(),
  // At most this many, best first. Not given: with something typed, the best 50; with nothing,
  // every place (what the picker loads).
  limit: z.coerce.number().int().min(1).max(10_000).optional(),
});

export async function places(query: z.infer<typeof placesQuery> = {}) {
  const typed = (query.q ?? "").trim() !== "";
  return {
    places: searchPlaces(await allPlaces(), {
      q: query.q,
      kinds: query.kind ? [query.kind] : undefined,
      limit: query.limit ?? (typed ? 50 : undefined),
    }),
  };
}
