// The coverage command's options (plan 2026-11-20-04, "One filter, everywhere"): one list, the
// same for every way in, the page's address, the API's query, the CLI's flags and the MCP tool's
// arguments, with one set of defaults, applied in the command. On its own so that void.config.ts
// can read its keys without the lists behind the command: the page cache keeps one page per value.
import { z } from "zod";

export const coverageOptions = z.object({
  // One place, a continent or a country, never both: a country's code ("TH", as the place picker
  // gives it), or a name as typed ("europe", "japan", "thialand"), found by the one place search.
  // Blank: everywhere. Anything, so that what a visitor types never ends on an error page.
  place: z.string().max(60).optional(),
  // Every probe city, with the rest: included unless false. True or false from an agent; "true" or
  // "false" in an address.
  cities: z.union([z.boolean(), z.stringbool()]).optional(),
});

// Its keys, for the page cache: every value makes its own cached page.
export const COVERAGE_OPTION_KEYS = Object.keys(coverageOptions.shape);
