// `runs` and `show`: the newest runs, a page at a time, and one with its fetches (src/runs.ts).
// Open, like the pages. `GET /api/runs`, `GET /api/runs/<id>`, the Runs pages' loaders, the MCP
// tools, and `show` as the MCP resource cloudflare-ping://runs/{id}.
import { fetches, runPlaces, runs as runsTable } from "@schema";
import { runs as runsDefinition, show as showDefinition } from "@cloudflare-ping/shared/commands";
import { cursorOf, readCursor } from "void-commands";
import { fail } from "void-commands/server";
import { createSelectSchema } from "void/drizzle-zod";
import { z } from "zod";
import { getRun, listRuns } from "../runs";
import { implement } from "./context";

// A run, as the database has it (db/schema.ts): its rows' schema comes from the table.
const runRow = createSelectSchema(runsTable);

export const runsAnswer = z.object({
  runs: z.array(
    runRow
      .pick({
        id: true,
        target: true,
        fromPlace: true,
        probes: true,
        repeat: true,
        background: true,
        measurement: true,
        error: true,
        createdAt: true,
      })
      .extend({ fetches: z.number() }),
  ),
  // Where the next lot starts (pass it as `cursor`), or null when these are the last.
  next: z.string().nullable(),
});

export const runs = implement(runsDefinition, runsAnswer, async ({ cursor, limit }) => {
  const after = readCursor(cursor);
  const { rows, more } = await listRuns(
    limit ?? 50,
    typeof after?.createdAt === "string" && typeof after.id === "string"
      ? { createdAt: after.createdAt, id: after.id }
      : undefined,
  );
  const last = rows.at(-1);
  return {
    runs: rows,
    next: more && last ? cursorOf({ createdAt: last.createdAt, id: last.id }) : null,
  };
});

export const showAnswer = z.object({
  run: runRow,
  fetches: z.array(createSelectSchema(fetches)),
  // A run everywhere: the data centres it expects (src/everywhere.ts).
  places: z.array(
    createSelectSchema(runPlaces).pick({
      colo: true,
      country: true,
      city: true,
      measurement: true,
      error: true,
    }),
  ),
});

export const show = implement(showDefinition, showAnswer, async ({ id }) => {
  const found = await getRun(id);
  return found ?? fail("not_found", `No such run: ${id}`);
});
