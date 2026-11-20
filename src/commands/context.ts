// Each thing the app does is written once, here in src/commands: what it takes (one zod schema)
// and what it does. Its API route (routes/api), its page's loader or action (pages) and, later,
// its MCP tool all run it, so they can't do different things; the CLI calls the route. The names
// are the CLI's (packages/shared/src/commands.ts).
//
import { COMMAND_LIST } from "@cloudflare-ping/shared/commands";
import { requireAuth } from "void/auth";

// Signed in, where the command list says the command needs it (packages/shared/src/commands.ts,
// `signedIn`): the one place that decides, for the command's API route and its page alike. The
// docs and `cloudflare-ping help` read the same list, so they say what's enforced.
export function signedInFor(command: string, ...auth: Parameters<typeof requireAuth>) {
  const found = COMMAND_LIST.find((each) => each.name === command);
  if (!found) {
    throw new Error(`No command ${command} (packages/shared/src/commands.ts)`);
  }
  return found.signedIn ? requireAuth(...auth) : null;
}

// What a command needs from the request it came in on, whichever way it came.
export type CommandContext = {
  // Work to finish even if the caller goes away (Cloudflare's `waitUntil`).
  waitUntil: (work: Promise<unknown>) => void;
  // The data centre this request ran in.
  colo: string | null;
};

type Incoming = {
  executionCtx: { waitUntil(work: Promise<unknown>): void };
  req: { raw: Request };
};

export function contextOf(c: Incoming): CommandContext {
  const colo = c.req.raw.cf?.colo;
  return {
    waitUntil: (work) => c.executionCtx.waitUntil(work),
    colo: typeof colo === "string" ? colo : null,
  };
}
