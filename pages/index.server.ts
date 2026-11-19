import { defineHandler, type InferProps } from "void";
import { getUser } from "void/auth";

export type Props = InferProps<typeof loader>;

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

export const loader = defineHandler((c) => {
  // Where this page was served from, as Cloudflare tells the Worker (as `/where` does).
  const cf = c.req.raw.cf;
  return {
    email: getUser()?.email ?? null,
    here: { colo: text(cf?.colo), city: text(cf?.city), country: text(cf?.country) },
  };
});
