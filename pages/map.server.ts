// The map (plan step 7): the newest (src/commands/map.ts, as `GET /api/map`), and the action that
// starts a new one (as `POST /api/map`), then shows it.
import { defineHandler, defineHead, type InferProps } from "void";
import { getUser } from "void/auth";
import { signedInFor } from "../src/commands/context";
import { map, remap, remapInput } from "../src/commands/map";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async () => ({
  email: getUser()?.email ?? null,
  ...(await map({})),
}));

export const action = defineHandler.withValidator({ body: remapInput })(async (c, { body }) => {
  signedInFor("remap", c);
  await remap(body);
  return c.redirect("/map");
});

export const head = defineHead(() => ({ title: "The map" }));
