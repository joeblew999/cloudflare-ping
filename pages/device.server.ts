import { defineHandler, type InferProps } from "void";
import { requireAuth } from "void/auth";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler((c) => {
  const url = new URL(c.req.url);
  const user = requireAuth(c, {
    throwRedirect: `/login?next=${encodeURIComponent(url.pathname + url.search)}`,
  });
  return { email: user.email, userCode: url.searchParams.get("user_code") ?? "" };
});
