// The coverage filter (plan 2026-11-20-04, "One filter, everywhere"), on its own so that
// void.config.ts can read its keys without the lists behind the command: the page's address, the
// API's query, the CLI's `--country` and the MCP tool's argument all take it, and the page cache
// keeps one page per value (`routing.revalidateQueryAllowlist`). A country's code, as the place
// picker gives it ("TH"), or its name as typed ("japan"), found by the one place search. Blank:
// every country. Anything, so that what a visitor types never ends on an error page.
import { z } from "zod";

export const coverageFilter = z.object({
  country: z.string().max(60).optional(),
});

// Its keys, for the page cache: every one the page reads makes its own cached page.
export const COVERAGE_FILTER_KEYS = Object.keys(coverageFilter.shape);
