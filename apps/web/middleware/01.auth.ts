// Who's signed in, for every page (Void's shared data: `useShared()` in pages/layout.tsx). Only
// the email address: it's sent to the browser.
import { defineMiddleware } from "void";
import { getUser } from "void/auth";

declare module "void" {
  interface CloudContextVariables {
    shared: { auth: { email: string | null } };
  }
}

export default defineMiddleware(async (c, next) => {
  c.set("shared", { auth: { email: getUser()?.email ?? null } });
  await next();
});
