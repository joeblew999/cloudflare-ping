// The home page: where it was served from, and one Globalping test (src/commands/test.ts). The
// action makes the test and redirects to `/?measurement=<id>`; the loader then waits for its
// answer as a deferred prop, so the page shows at once, and the answer has its own link.
import { defineHandler, defineHead, defer, type InferProps } from "void";
import { getUser } from "void/auth";
import { signedInFor } from "../src/commands/context";
import { routeUrl } from "void/routes";
import { z } from "zod";
import { measurementId, result, start, test } from "../src/commands/test";

export type Props = InferProps<typeof loader>;

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

export const loader = defineHandler.withValidator({
  query: z.object({ measurement: measurementId.optional() }),
})((c, { query }) => {
  // Where this page was served from, as Cloudflare tells the Worker (as `/where` does).
  const cf = c.req.raw.cf;
  const measurement = query.measurement ?? null;
  return {
    email: getUser()?.email ?? null,
    here: { colo: text(cf?.colo), city: text(cf?.city), country: text(cf?.country) },
    measurement,
    // Globalping's words when it can't be read (gone, or refused), shown in place of the answer.
    answer: measurement
      ? defer(async () => {
          try {
            return { ok: true as const, test: await result(measurement) };
          } catch (caught) {
            return {
              ok: false as const,
              error: caught instanceof Error ? caught.message : "Failed",
            };
          }
        })
      : null,
  };
});

export const action = defineHandler.withValidator({ body: test.definition.input })(async (
  c,
  { body },
) => {
  signedInFor(test.definition, c);
  const measurement = await start(body);
  return c.redirect(routeUrl("/", { query: { measurement }, hash: "probe" }));
});

export const head = defineHead(() => ({
  title: "Probes from around the world, run from Cloudflare's data centres",
}));
