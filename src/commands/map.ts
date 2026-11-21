// `map` and `remap` (plan step 7, src/map.ts). `map`: a map (the newest, unless given), open.
// `remap`: start a new one, signed in only: it spends one Globalping test per place. `GET` and
// `POST /api/map`, the Map page's loader and action, the MCP tools, and `map` as the MCP resource
// cloudflare-ping://maps/{id}.
import { maps } from "@schema";
import { map as mapDefinition, remap as remapDefinition } from "@cloudflare-ping/shared/commands";
import { createSelectSchema } from "void/drizzle-zod";
import { z } from "zod";
import { mapSummary, startMap } from "../map";
import { implement } from "./context";

export const mapAnswer = z.object({
  // The map, as the database has it; null before the first.
  map: createSelectSchema(maps).nullable(),
  tests: z.number(),
  missed: z.number(),
  countriesDone: z.number(),
  // Each data centre the probes reached: how many places reached it, from which countries.
  reached: z.array(
    z.object({
      colo: z.string().nullable(),
      name: z.string().nullable(),
      region: z.string().nullable(),
      places: z.number(),
      countries: z.string(),
    }),
  ),
  // How many data centres Cloudflare lists.
  datacentres: z.number(),
});

export const map = implement(mapDefinition, mapAnswer, ({ id }) => mapSummary(id));

// The new map: how many places it asks about (one queued test each), in how many countries.
export const remapAnswer = z.object({
  id: z.string(),
  level: z.string(),
  places: z.number(),
  countries: z.number(),
  tests: z.number(),
});

export const remap = implement(remapDefinition, remapAnswer, (body) =>
  startMap(body.level, body.countries),
);
