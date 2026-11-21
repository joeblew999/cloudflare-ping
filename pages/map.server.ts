// The map (plan step 7): the newest (src/commands/map.ts, as `GET /api/map`), and the action that
// starts a new one (as `POST /api/map`), then shows it.
import { defineHandler, defineHead, type InferProps } from "void";
import { getUser } from "void/auth";
import { runCommand } from "../src/commands/context";
import { map, remap } from "../src/commands/map";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => ({
  email: getUser()?.email ?? null,
  ...(await runCommand(c, map, {}, { surface: "page" })),
}));

export const action = defineHandler.withValidator({ body: remap.definition.input })(async (
  c,
  { body },
) => {
  await runCommand(c, remap, body, { surface: "page" });
  return c.redirect("/map");
});

export const head = defineHead(() => ({ title: "The map" }));
