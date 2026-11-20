// The runs queue (src/everywhere.ts): a run everywhere's probes, 50 places to a message, each
// one Globalping test to `/run` for the run. One at a time, waiting for Globalping's reset when a
// message needs more tests than are left this hour, as the map's queue does.
import { defineQueue } from "void";
import { logger } from "void/log";
import { sendPlaces, type RunPlacesMessage } from "../src/everywhere";

export const maxBatchSize = 1;
export const maxConcurrency = 1;
export const maxRetries = 30;

export default defineQueue<RunPlacesMessage>(async (batch) => {
  for (const message of batch.messages) {
    try {
      const done = await sendPlaces(message.body);
      if ("wait" in done) {
        message.retry({ delaySeconds: Math.min(Math.max(done.wait + 5, 60), 3600) });
      } else {
        message.ack();
      }
    } catch (caught) {
      logger.error(`Run ${message.body.runId}: sending its probes failed, trying again`, {
        error: caught instanceof Error ? caught.message : String(caught),
      });
      message.retry({ delaySeconds: 300 });
    }
  }
});
