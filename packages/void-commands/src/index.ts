// void-commands: each thing a Void app does, written once as a definition, and reached from every
// surface: its API route, its pages, an MCP server (void-commands/server) and a CLI
// (void-commands/cli). This entry runs anywhere (the Worker, Node, a CLI bundle): definitions and
// the failure kinds only, no code that runs a command.
import type { z } from "zod";

// A command's input: an object schema, its fields any schema.
export type InputSchema = z.ZodObject<z.core.$ZodShape>;

// One of a command's CLI flags, as node:util's parseArgs takes it (it reads only the keys it knows,
// so the flags go to it as they are), with its words for `help`. `hint`: what to write after it in
// the usage line (`--from TH`); the flag's name otherwise.
export type Flag =
  | { type: "string"; default?: string; help: string; hint?: string }
  | { type: "boolean"; default?: boolean; help: string };

// How a command is reached from a CLI: its bare argument (`show <id>`: id), and its flags.
export type CliShape<Input extends InputSchema> = {
  argument: (keyof z.input<Input> & string) | null;
  flags: Readonly<Record<string, Flag>>;
};

// What a command is: everything every surface needs to know about it, and nothing that runs it.
export type CommandDefinition<
  Name extends string = string,
  Input extends InputSchema = InputSchema,
  Path extends string = string,
  Cli extends CliShape<Input> | null = CliShape<Input> | null,
> = {
  name: Name;
  // What it does, in a few words: the CLI's help, the docs, the MCP tool's first sentence.
  about: string;
  // What it takes: one schema for every surface. `.describe()` on a field says what it means,
  // for the MCP tool and the OpenAPI document.
  input: Input;
  // Its API route: a Void route path, as the app's typed routes name it.
  api: { method: "GET" | "POST"; path: Path } | null;
  // Where the web does the same, for people (the help, the docs).
  page: string | null;
  // The repo's task that runs it from source, if it has one.
  task: string | null;
  // Whether it needs someone signed in (API, pages, CLI).
  signedIn: boolean;
  // Whether it spends something counted or paid for: never called by checks, asked about first
  // over MCP, deduplicated when called twice, and only for an MCP token with the spend scope.
  spends: boolean;
  // Whether it's an MCP tool.
  mcp: boolean;
  // How a CLI takes it, if it has a CLI command: its flags keep their own types, for parseArgs.
  cli: Cli;
  // Work that goes on after the reply: which command follows it, by which field of the answer,
  // and the MCP resource that shows it (`app://runs/{id}`).
  follow?: { command: string; by: string; uri: string };
  // A thing to read as well as a tool: the MCP resource template, with the input's keys in braces.
  resource?: { uri: string; title: string };
  // A page that shows its answer in an AI's chat, for a client that can show one (an MCP App:
  // its page is built by void-commands/vite and handed to the MCP server); others get the answer.
  app?: { title: string };
};

// A definition, with its literal name and route path kept for the types.
export const defineCommand = <
  const Name extends string,
  Input extends InputSchema,
  const Path extends string,
  const Cli extends CliShape<Input> | null,
>(
  definition: CommandDefinition<Name, Input, Path, Cli>,
): CommandDefinition<Name, Input, Path, Cli> => definition;

// The ways a command can fail, and what each is on each surface: the HTTP status (the API and the
// pages), the CLI's exit code. MCP gives the words as the tool's error. A command says which kind
// (`fail`, void-commands/server); it never writes a status.
export const FAILURES = {
  // The input isn't what the command takes.
  bad_input: { status: 400, exit: 2 },
  // It needs someone signed in, and nobody is.
  signed_out: { status: 401, exit: 3 },
  // Signed in or not, this isn't allowed (a target not on the list, a missing scope).
  not_allowed: { status: 403, exit: 4 },
  // What it was asked about isn't there.
  not_found: { status: 404, exit: 5 },
  // A limit was reached (tests this hour, a quota): try later.
  limit_reached: { status: 429, exit: 6 },
  // Another service refused or failed.
  refused: { status: 502, exit: 7 },
  // The app isn't set up for it (a secret it needs isn't there).
  not_set_up: { status: 503, exit: 8 },
} as const;

export type FailureKind = keyof typeof FAILURES;

export const FAILURE_KINDS = Object.keys(FAILURES).filter(
  (each): each is FailureKind => each in FAILURES,
);

// The kind an HTTP status means, for a surface that only sees the status (a CLI reading the API).
export function kindOfStatus(status: number): FailureKind | null {
  return FAILURE_KINDS.find((kind) => FAILURES[kind].status === status) ?? null;
}

// A list's place to carry on from: opaque to callers, so the command can change how it pages.
export function cursorOf(value: Record<string, string | number>): string {
  return btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function readCursor(cursor: string | undefined): Record<string, unknown> | null {
  if (!cursor) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(atob(cursor.replaceAll("-", "+").replaceAll("_", "/")));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed))
      : null;
  } catch {
    return null;
  }
}
