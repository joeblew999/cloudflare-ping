import { defineHandler, defineHead, type InferProps } from "void";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler((c) => {
  const next = c.req.query("next") ?? "/";
  // Only a path on this site, so signing in can't send anyone elsewhere.
  const local = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\");
  return {
    next: local ? next : "/",
    // An MCP client's sign-in (auth.ts, `mcp()`): Void's auth sent the agent's request here,
    // signed, and signing in carries on with it.
    forAgent: Boolean(c.req.query("client_id") && c.req.query("sig")),
  };
});

export const head = defineHead(() => ({ title: "Sign in" }));
