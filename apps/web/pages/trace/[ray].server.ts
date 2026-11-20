import { HTTPException } from "hono/http-exception";
import { defineHandler, defineHead, type InferProps } from "void";
import { signedInFor } from "../../src/commands/context";
import { routeUrl } from "void/routes";
import { bareRay } from "../../src/trace";
import { trace, traceParams } from "../../src/commands/trace";

export type Props = InferProps<typeof loader>;

// The same as `GET /api/trace/<ray id>` (src/commands/trace.ts): signed in only, over the last
// day. Not set up (no token: 503) and other failures are shown on the page.
export const loader = defineHandler.withValidator({ params: traceParams })(async (
  c,
  { params },
) => {
  signedInFor("trace", c, {
    throwRedirect: routeUrl("/login", {
      query: { next: routeUrl("/trace/[ray]", { params: { ray: params.ray } }) },
    }),
  });
  const ray = bareRay(params.ray);
  try {
    const found = await trace({ ray, minutes: 1440 });
    return { ray, setUp: true, logs: found.logs, error: null };
  } catch (caught) {
    if (caught instanceof HTTPException && caught.status === 503) {
      return { ray, setUp: false, logs: [], error: null };
    }
    return {
      ray,
      setUp: true,
      logs: [],
      error: caught instanceof Error ? caught.message : "Failed",
    };
  }
});

export const head = defineHead<Props>((_c, props) => ({ title: `Request ${props.ray}` }));
