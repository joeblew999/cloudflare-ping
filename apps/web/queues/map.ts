// The map's queue (src/map.ts): one message per country (or per 50 of its cities), each one test
// to `/where`. One at a time, since Globalping counts tests by the hour: a message that needs more
// tests than are left waits for Globalping's reset (retried after it), so a long map spreads
// itself over the hours it takes.
import { defineQueue } from "void";
import { logger } from "void/log";
import { mapPlaces, type MapMessage } from "../src/map";

export const maxBatchSize = 1;
export const maxConcurrency = 1;
// Enough to wait out a day of hourly limits.
export const maxRetries = 30;

export default defineQueue<MapMessage>(async (batch) => {
  for (const message of batch.messages) {
    try {
      const done = await mapPlaces(message.body);
      if ("wait" in done) {
        message.retry({ delaySeconds: Math.min(Math.max(done.wait + 5, 60), 3600) });
      } else {
        message.ack();
      }
    } catch (caught) {
      logger.error(`Map ${message.body.mapId}, ${message.body.country}: failed, trying again`, {
        error: caught instanceof Error ? caught.message : String(caught),
      });
      message.retry({ delaySeconds: 300 });
    }
  }
});
