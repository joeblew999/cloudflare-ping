// The coverage command's options (plan 2026-11-20-04, "One filter, everywhere"), one list for every
// way in: the page's address, the API's query, the CLI's flags and the MCP tool's arguments, with
// the same defaults for all. On its own so that void.config.ts can read its keys without the lists
// behind the command: the page cache keeps one page per value (`routing.revalidateQueryAllowlist`).
import { z } from "zod";

export const coverageOptions = z.object({
  // One country: its code, as the place picker gives it ("TH"), or its name as typed ("japan"),
  // found by the one place search. Blank: every country. Anything, so that what a visitor types
  // never ends on an error page.
  country: z.string().max(60).optional(),
  // With every probe city (about 1,100 when it's every country). Left out unless asked, everywhere:
  // the page asks, to draw them; the CLI asks, to list a country's. True or false, from an agent;
  // "true" or "false" in an address.
  cities: z.union([z.boolean(), z.stringbool()]).optional(),
});

// What the page's address takes: the country (the page always asks for the cities itself, to draw
// them). Taken from the list above, not written again.
export const coveragePageOptions = coverageOptions.pick({ country: true });

// Its keys, for the page cache: every one the page reads makes its own cached page.
export const COVERAGE_PAGE_KEYS = Object.keys(coveragePageOptions.shape);
