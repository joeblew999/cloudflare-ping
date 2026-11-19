// Who's signed in, and where the page is, for every page (Void's shared data: `useShared()` in
// pages/layout.tsx). Only the email address: it's sent to the browser.
import { defineMiddleware } from "void";
import { getUser } from "void/auth";

declare module "void" {
  interface CloudContextVariables {
    shared: { auth: { email: string | null }; path: string };
  }
}

export default defineMiddleware(async (c, next) => {
  c.set("shared", {
    auth: { email: getUser()?.email ?? null },
    path: new URL(c.req.url).pathname,
  });
  await next();
});
