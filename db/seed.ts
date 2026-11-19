// Local development only (`void db seed`): one run to record into, for trying `/run?run=local-run`.
import { defineSeed } from "void/seed";

export default defineSeed<typeof import("./schema")>(async ({ db, schema }) => {
  await db.insert(schema.runs).values({
    id: "local-run",
    target: "https://void-fbtee-example.gedw99.workers.dev/en-US/events",
  });
});
