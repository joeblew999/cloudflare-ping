// Each thing the app does is defined once (packages/shared/src/commands.ts) and its code is here in
// src/commands, as `implement(definition, output, run)`: what it answers (one schema) and what it
// does. Its API route (routes/api), its page's loader or action (pages) and its MCP tool
// (src/mcp.ts) all run it with the same input, so they can't do different things; the CLI calls
// the route.
import type { z } from "zod";
import type { CommandDefinition } from "void-commands";
import {
  call,
  implementer,
  type AnyImplementation,
  type CallLog,
  type Implementation,
} from "void-commands/server";
import type { CloudContext } from "void";
import { requireAuth } from "void/auth";
import { logger } from "void/log";

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

// A command's code, with this app's context.
export const implement = implementer<CommandContext>();

export type AppCommand = AnyImplementation<CommandContext>;

// One line per command called, on every surface (plan 2026-11-21-01, step 13): which, from where,
// by whom, how long, and how it failed. In Workers Logs, so when the tests run out they say who
// spent them.
export function logCall(entry: CallLog) {
  const how = entry.failure
    ? `failed (${entry.failure})`
    : entry.same
      ? "the same call again, nothing spent"
      : "done";
  logger.info(`${entry.command} from ${entry.surface}: ${how} in ${entry.ms} ms`, entry);
}

// A command for an API route or a page: signed in first when its definition says so (Void's
// `requireAuth`: a 401 for the API; a page can pass where to sign in instead), run with the
// request's context, and logged.
export function runCommand<Definition extends CommandDefinition, Answer>(
  c: Incoming & CloudContext,
  command: Implementation<Definition, z.ZodType, Answer, CommandContext>,
  input: z.output<Definition["input"]>,
  how: { surface?: "api" | "page"; throwRedirect?: string } = {},
): Promise<Answer> {
  return call(command, input, contextOf(c), {
    surface: how.surface ?? "api",
    signIn: () =>
      requireAuth(c, how.throwRedirect ? { throwRedirect: how.throwRedirect } : undefined),
    log: logCall,
  });
}

// Signed in when a command's definition says so, for a page that runs part of a command (the home
// page's action starts a test without waiting for it).
export function signedInFor(
  definition: { signedIn: boolean },
  c: CloudContext,
  options?: { throwRedirect?: string },
) {
  return definition.signedIn ? requireAuth(c, options) : null;
}
