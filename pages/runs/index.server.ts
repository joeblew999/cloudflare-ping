// Runs: the newest (src/commands/runs.ts, as `GET /api/runs`), Globalping's limit as a deferred
// prop (src/commands/limits.ts, as `GET /api/limits`), and the action that starts one
// (src/commands/run.ts, as `POST /api/runs`), then opens its page. The places for its From and data
// centres boxes come deferred too (src/commands/places.ts).
import { defineHandler, defineHead, defer, type InferProps } from "void";
import { getUser } from "void/auth";
import { routeUrl } from "void/routes";
import { PLACE_FIELDS } from "@cloudflare-ping/shared/places";
import { runCommand } from "../../src/commands/context";
import { limits } from "../../src/commands/limits";
import { placesFor } from "../../src/commands/places";
import { run } from "../../src/commands/run";
import { runs } from "../../src/commands/runs";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const newest = await runCommand(c, runs, {}, { surface: "page" });
  return {
    email: getUser()?.email ?? null,
    runs: newest.runs,
    places: defer(() => placesFor(PLACE_FIELDS.from, PLACE_FIELDS.datacentres)),
    // Globalping's words when it can't be asked, shown in place of the limit.
    limits: defer(async () => {
      try {
        return {
          ok: true as const,
          found: await runCommand(c, limits, {}, { surface: "page" }),
        };
      } catch (caught) {
        return { ok: false as const, error: caught instanceof Error ? caught.message : "Failed" };
      }
    }),
  };
});

export const action = defineHandler.withValidator({ body: run.definition.input })(async (
  c,
  { body },
) => {
  const started = await runCommand(c, run, body, { surface: "page" });
  return c.redirect(routeUrl("/runs/[id]", { params: { id: started.id } }));
});

export const head = defineHead(() => ({ title: "Runs" }));
