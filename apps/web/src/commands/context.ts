// Each thing the app does is written once, here in src/commands: what it takes (one zod schema)
// and what it does. Its API route (routes/api), its page's loader or action (pages) and, later,
// its MCP tool all run it, so they can't do different things; the CLI calls the route. The names
// are the CLI's (packages/shared/src/commands.ts).
//
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
