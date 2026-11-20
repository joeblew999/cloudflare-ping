// Globalping's limit in the words the Runs page and the CLI's `limits` show.
import { describe, expect, it } from "vite-plus/test";
import { limitsLine } from "./limits";

const globalping = { by: "ip", limit: 250, remaining: 248, resetSeconds: 0, credits: null };

describe("limitsLine", () => {
  it("names the Worker's address when the app has no token", () => {
    expect(
      limitsLine({
        colo: "BKK",
        address: "203.0.113.7",
        globalping: { ...globalping, token: false },
      }),
    ).toBe(
      "Globalping: 248 of 250 tests left this hour for the Worker's address 203.0.113.7 in BKK, shared with other Cloudflare customers (no Globalping token set).",
    );
  });

  it("names the account, when it resets, and its credits", () => {
    expect(
      limitsLine({
        colo: "BKK",
        address: null,
        globalping: { ...globalping, token: true, limit: 500, resetSeconds: 1500, credits: 40 },
      }),
    ).toBe(
      "Globalping: 248 of 500 tests left this hour for the app's Globalping account, more in 25 min, and 40 credits.",
    );
  });
});
