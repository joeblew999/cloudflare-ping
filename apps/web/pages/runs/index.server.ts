// Runs: the newest (src/commands/runs.ts, as `GET /api/runs`), Globalping's limit as a deferred
// prop (src/commands/limits.ts, as `GET /api/limits`), and the action that starts one
// (src/commands/run.ts, as `POST /api/runs`), then opens its page.
import { defineHandler, defineHead, defer, type InferProps } from "void";
import { getUser } from "void/auth";
import { routeUrl } from "void/routes";
import { contextOf, signedInFor } from "../../src/commands/context";
import { limits } from "../../src/commands/limits";
import { input, run } from "../../src/commands/run";
import { runs } from "../../src/commands/runs";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  const context = contextOf(c);
  return {
    email: getUser()?.email ?? null,
    ...(await runs()),
    // Globalping's words when it can't be asked, shown in place of the limit.
    limits: defer(async () => {
      try {
        return { ok: true as const, found: await limits(context) };
      } catch (caught) {
        return { ok: false as const, error: caught instanceof Error ? caught.message : "Failed" };
      }
    }),
  };
});

export const action = defineHandler.withValidator({ body: input })(async (c, { body }) => {
  signedInFor("run", c);
  const started = await run(body, contextOf(c));
  return c.redirect(routeUrl("/runs/[id]", { params: { id: started.id } }));
});

export const head = defineHead(() => ({ title: "Runs" }));
