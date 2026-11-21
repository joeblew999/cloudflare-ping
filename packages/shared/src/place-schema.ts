// A place's schema (packages/shared/src/places.ts): the MCP tool's and the API's answer for
// `places`, and where the Place type comes from. On its own so the browser's place picker, which
// runs the search, doesn't load zod.
import { z } from "zod";
import { PLACE_KINDS } from "@cloudflare-ping/shared/places";

export const placeSchema = z.object({
  kind: z.enum(PLACE_KINDS),
  // What people read: "Bangkok", "Thailand", "Amazon.com", "BKK".
  name: z.string(),
  // Where it is, or what it is, after the name: "Thailand (TH)", "Virginia (US-VA)",
  // "AS14618, AS16509", "Bangkok, Thailand".
  within: z.string().nullable(),
  // What it's found by exactly: "TH", "US-VA", "AS13335", "BKK".
  codes: z.array(z.string()),
  // What's sent to Globalping as the place to test from (its location "magic"): "TH",
  // "Bangkok+TH", "Ashburn+US-VA", "Amazon.com". A data centre's is its code.
  magic: z.string(),
  // Globalping's probes there (none for a data centre: they're Cloudflare's).
  probes: z.number(),
  // Its country (ISO code), where it has one: for narrowing lists.
  country: z.string().nullable(),
});
export type Place = z.infer<typeof placeSchema>;
