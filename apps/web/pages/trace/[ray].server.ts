import { defineHandler, type InferProps } from "void";
import { requireAuth } from "void/auth";
import { env } from "void/env";
import { z } from "zod";
import { bareRay, traceOf } from "../../src/trace";

export type Props = InferProps<typeof loader>;

// The same as `GET /api/trace/<ray id>` (src/trace.ts): signed in only, over the last day.
export const loader = defineHandler.withValidator({
  params: z.object({ ray: z.string().regex(/^[0-9a-f]{16}(-[A-Z]{3})?$/) }),
})(async (c, { params }) => {
  const url = new URL(c.req.url);
  requireAuth(c, { throwRedirect: `/login?next=${encodeURIComponent(url.pathname)}` });
  const ray = bareRay(params.ray);
  const token = env.CLOUDFLARE_OBSERVABILITY_TOKEN;
  if (!token) {
    return { ray, setUp: false, logs: [], error: null };
  }
  try {
    const found = await traceOf(ray, 1440, token);
    return { ray, setUp: true, logs: found.logs, error: null };
  } catch (caught) {
    return {
      ray,
      setUp: true,
      logs: [],
      error: caught instanceof Error ? caught.message : "Failed",
    };
  }
});
