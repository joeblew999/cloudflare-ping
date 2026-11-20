import { defineHandler, defineHead, type InferProps } from "void";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler((c) => {
  const next = c.req.query("next") ?? "/";
  // Only a path on this site, so signing in can't send anyone elsewhere.
  const local = next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\");
  return { next: local ? next : "/" };
});

export const head = defineHead(() => ({ title: "Sign in" }));
