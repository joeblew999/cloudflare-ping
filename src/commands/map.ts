// `map` and `remap` (plan step 7, src/map.ts). `map`: a map (the newest, unless given), open.
// `remap`: start a new one, signed in only: it spends one Globalping test per place. `GET` and
// `POST /api/map`, the Map page's loader and action, and the MCP tools.
import { z } from "zod";
import { mapSummary, startMap } from "../map";

export const mapQuery = z.object({ id: z.string().min(8).max(64).optional() });

export const map = ({ id }: z.infer<typeof mapQuery>) => mapSummary(id);

export const remapInput = z.object({
  // One probe per country (about 120 tests for the world), or per city (about 1,100).
  level: z.enum(["country", "city"]),
  // Only these countries, by ISO code (TH, SG): a small map, to try it.
  countries: z
    .array(z.string().regex(/^[A-Za-z]{2}$/, "A country's two-letter code, such as TH"))
    .max(50)
    .optional(),
});

export const remap = (body: z.infer<typeof remapInput>) => startMap(body.level, body.countries);
