import { defineHandler, defineHead, type InferProps } from "void";
import { failureOf } from "void-commands/server";
import { runCommand, signedInFor } from "../../src/commands/context";
import { routeUrl } from "void/routes";
import { bareRay } from "../../src/trace";
import { trace } from "../../src/commands/trace";

export type Props = InferProps<typeof loader>;

// The same as `GET /api/trace/<ray id>` (src/commands/trace.ts): signed in only, over the last
// day. Not set up (no token) and other failures are shown on the page.
export const loader = defineHandler.withValidator({
  params: trace.definition.input.pick({ ray: true }),
})(async (c, { params }) => {
  // Signed out: to /login, and back here after (outside the `try`, so the redirect isn't shown
  // as a failure).
  signedInFor(trace.definition, c, {
    throwRedirect: routeUrl("/login", {
      query: { next: routeUrl("/trace/[ray]", { params: { ray: params.ray } }) },
    }),
  });
  const ray = bareRay(params.ray);
  try {
    const found = await runCommand(c, trace, { ray, minutes: 1440 }, { surface: "page" });
    return { ray, setUp: true, logs: found.logs, error: null };
  } catch (caught) {
    const failure = failureOf(caught);
    if (failure?.kind === "not_set_up") {
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
