// Live updates (Void's `void/live`, guide/live.md): a run's page subscribes to its run's topic,
// `run:<id>`, and `/run` publishes each fetch it records there, so the page shows them as they
// happen. Runs are open to read (`GET /api/runs`), so anyone may follow one; no other topic is
// allowed. Void runs this on a Durable Object it manages.
import { defineLiveStream } from "void/live";

export const RUN_TOPIC = /^run:[A-Za-z0-9-]{8,64}$/;

export const runTopic = (id: string) => `run:${id}`;

export const live = defineLiveStream({
  id: "app",
  // The pages are open, so a visitor who isn't signed in can follow a run too.
  allowAnonymousControl: true,
  onSubscribe(ctx) {
    if (RUN_TOPIC.test(ctx.topic)) {
      return undefined;
    }
    return new Response("Only a run's topic can be followed", { status: 403 });
  },
});
