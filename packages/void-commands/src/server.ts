// void-commands/server: what runs in the Worker. A command's code is `implement(definition,
// output, run)`; it fails with `fail(kind, words)`; `call` runs it for the API and the pages; and
// `commandsMcpServer` and `openApiOf` make the MCP server and the OpenAPI document from the list.
import {
  RESOURCE_MIME_TYPE,
  RESOURCE_URI_META_KEY,
  registerAppResource,
} from "@modelcontextprotocol/ext-apps/server";
import { HTTPException } from "hono/http-exception";
import {
  McpServer,
  ResourceNotFoundError,
  ResourceTemplate,
  acceptedContent,
  inputRequired,
  requireScopes,
  type CallToolResult,
  type ContentBlock,
  type InputRequiredResult,
  type McpServerOptions,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { FAILURES, kindOfStatus, type CommandDefinition, type FailureKind } from "void-commands";

// A failure of a kind (FAILURES): a Hono HTTPException underneath, with the kind's status, so
// Void shows the right page and a form shows the words (Void: guide/pages-routing/errors.md).
export class CommandFailure extends HTTPException {
  readonly kind: FailureKind;
  constructor(kind: FailureKind, message: string) {
    super(FAILURES[kind].status, { message });
    this.kind = kind;
  }
}

export function fail(kind: FailureKind, message: string): never {
  throw new CommandFailure(kind, message);
}

// What a caught error was, as a failure: a command's own, an HTTPException from what it uses
// (Void's requireAuth: 401), or input a schema refused. Anything else isn't a failure the command
// meant: null, and the caller lets it through.
export function failureOf(caught: unknown): { kind: FailureKind; message: string } | null {
  if (caught instanceof CommandFailure) {
    return { kind: caught.kind, message: caught.message };
  }
  if (caught instanceof HTTPException) {
    const kind = kindOfStatus(caught.status);
    return kind ? { kind, message: caught.message || kind.replaceAll("_", " ") } : null;
  }
  if (caught instanceof z.ZodError) {
    return { kind: "bad_input", message: z.prettifyError(caught) };
  }
  return null;
}

// A command's code: its definition, the schema of what it answers, and the function. The
// function's input comes from the definition's schema; what it returns must fit the output
// schema (checked by the compiler, and by the MCP SDK against `structuredContent`), and keeps its
// own exact type for the API's typed fetch and the pages' props.
export type Implementation<
  Definition extends CommandDefinition,
  Output extends z.ZodType,
  Answer,
  Context,
> = {
  definition: Definition;
  output: Output;
  // A method, so a list can hold commands with different inputs.
  run(input: z.output<Definition["input"]>, context: Context): Promise<Answer>;
};

// Any command of an app, for lists of them.
export type AnyImplementation<Context> = Implementation<
  CommandDefinition,
  z.ZodType,
  unknown,
  Context
>;

// `implement` for an app's own context (what a command needs from the request it came in on).
export const implementer =
  <Context>() =>
  <Definition extends CommandDefinition, Output extends z.ZodType, Answer extends z.input<Output>>(
    definition: Definition,
    output: Output,
    run: (input: z.output<Definition["input"]>, context: Context) => Promise<Answer> | Answer,
  ): Implementation<Definition, Output, Answer, Context> => ({
    definition,
    output,
    run: async (input, context) => run(input, context),
  });

// One line per call, for the app's logger: who called which command, from where, how it went.
export type CallLog = {
  command: string;
  surface: "api" | "page" | "mcp" | "resource";
  client: string | null;
  user: string | null;
  ms: number;
  spends: boolean;
  failure: FailureKind | "error" | null;
  // An MCP call answered from the first of the same two (`sameCall`), spending nothing.
  same?: boolean;
};

// Run a command for the API or a page: signed in first when the definition says so (`signIn`,
// the app's: Void's requireAuth), then logged.
export async function call<Definition extends CommandDefinition, Answer, Context>(
  command: Implementation<Definition, z.ZodType, Answer, Context>,
  input: z.output<Definition["input"]>,
  context: Context,
  how: {
    surface: "api" | "page";
    signIn: () => { id: string } | { email: string } | null;
    log?: (entry: CallLog) => void;
  },
): Promise<Answer> {
  const user = command.definition.signedIn ? how.signIn() : null;
  const started = Date.now();
  let failure: CallLog["failure"] = null;
  try {
    return await command.run(input, context);
  } catch (caught) {
    failure = failureOf(caught)?.kind ?? "error";
    throw caught;
  } finally {
    how.log?.({
      command: command.definition.name,
      surface: how.surface,
      client: null,
      user: user ? ("email" in user ? user.email : user.id) : null,
      ms: Date.now() - started,
      spends: command.definition.spends,
      failure,
    });
  }
}

// Who's calling over MCP: the OAuth client, the user, and the token's scopes.
export type McpCaller = {
  client: string | null;
  user: string | null;
  scopes: ReadonlyArray<string>;
};

// Where the same call twice is remembered: the app's KV.
export type SameCallStore = {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown, seconds: number): Promise<void>;
};

export type McpOptions<Context> = {
  info: { name: string; version: string; title?: string; instructions?: string };
  commands: ReadonlyArray<AnyImplementation<Context>>;
  context: Context;
  caller: McpCaller;
  // The scope a token needs for a command that spends (none: any token).
  spendScope?: string;
  // What a command that spends spends, for its tool's description ("Globalping tests").
  spending?: string;
  // The same call to a command that spends, twice within `seconds`: the first answer, once.
  sameCall?: { store: SameCallStore; seconds: number };
  // The question to ask before a command that spends runs, when the client can ask its user.
  askBeforeSpending?: (definition: CommandDefinition) => Promise<string>;
  log?: (entry: CallLog) => void;
  serverOptions?: McpServerOptions;
  // Each command with an `app`: its page, one HTML string (void-commands/vite), by the command's
  // name.
  apps?: Readonly<Record<string, string>>;
};

// Where a command's app is: one page per command, named by the server and the command.
const appUriOf = (server: string, command: string) => `ui://${server}/${command}.html`;

// A stable text of a value: the same input written in another order is the same call.
function stable(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stable).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .filter(([, each]) => each !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, each]) => `${JSON.stringify(key)}:${stable(each)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const asObject = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

// A tool's description, for the AI: what it does, what it spends, what follows it. What each
// input means is on the input schema's fields (`.describe()`), which the client shows with it.
function describe(definition: CommandDefinition, options: McpOptions<unknown>) {
  const words = [`${definition.about}.`];
  if (definition.spends) {
    words.push(
      `It spends ${options.spending ?? "something counted"}${options.askBeforeSpending ? "; it asks first when it can" : ""}.`,
    );
    if (options.sameCall) {
      words.push(
        `Called again with the same input within ${Math.round(options.sameCall.seconds / 60)} minutes, it answers the first call again and spends nothing.`,
      );
    }
  }
  if (definition.follow) {
    words.push(
      `It answers when the work starts, not when it's done: read the resource it links (${definition.follow.uri}), or call ${definition.follow.command} with its ${definition.follow.by}, to see it come in.`,
    );
  }
  return words.join(" ");
}

const GO = z.object({ go: z.boolean().describe("Go ahead") });

// The MCP server for an app's commands: one tool per command with `mcp`, one resource template per
// command with a `resource`, from the definitions alone. Stateless (made for each request, as the
// SDK's `createMcpHandler` asks): nothing is kept but what `sameCall` keeps.
export function commandsMcpServer<Context>(options: McpOptions<Context>) {
  const server = new McpServer(
    { name: options.info.name, version: options.info.version, title: options.info.title },
    { ...options.serverOptions, instructions: options.info.instructions },
  );
  const logged = (entry: Omit<CallLog, "client" | "user">) =>
    options.log?.({ ...entry, client: options.caller.client, user: options.caller.user });

  for (const command of options.commands) {
    const { definition } = command;
    if (!definition.mcp) {
      continue;
    }
    server.registerTool(
      definition.name,
      {
        description: describe(definition, options),
        inputSchema: definition.input,
        outputSchema: command.output,
        annotations: definition.spends
          ? {
              readOnlyHint: false,
              destructiveHint: false,
              idempotentHint: false,
              openWorldHint: true,
            }
          : { readOnlyHint: true },
        ...(definition.spends && options.spendScope
          ? { scopeChallenge: requireScopes(options.spendScope) }
          : {}),
        // Its app, as `registerAppTool` says it (@modelcontextprotocol/ext-apps/server): the
        // page's address, under today's key and the one older hosts read.
        ...(definition.app
          ? {
              _meta: {
                ui: { resourceUri: appUriOf(options.info.name, definition.name) },
                [RESOURCE_URI_META_KEY]: appUriOf(options.info.name, definition.name),
              },
            }
          : {}),
      },
      async (
        input: z.output<typeof definition.input>,
        ctx,
      ): Promise<CallToolResult | InputRequiredResult> => {
        const started = Date.now();
        if (definition.spends && options.askBeforeSpending) {
          const canAsk = server.server.getClientCapabilities()?.elicitation !== undefined;
          const responded = ctx.mcpReq.inputResponses?.go !== undefined;
          if (canAsk && !responded) {
            return inputRequired({
              inputRequests: {
                go: inputRequired.elicit({
                  message: await options.askBeforeSpending(definition),
                  requestedSchema: GO,
                }),
              },
            });
          }
          if (responded && acceptedContent(ctx.mcpReq.inputResponses, "go", GO)?.go !== true) {
            return {
              isError: true,
              content: [{ type: "text", text: "Not started: the user said no." }],
            };
          }
        }
        const key =
          definition.spends && options.sameCall
            ? `same-call:${await sha256(
                stable([options.caller.client, options.caller.user, definition.name, input]),
              )}`
            : null;
        if (key && options.sameCall) {
          const earlier = asObject(await options.sameCall.store.get(key));
          if (earlier) {
            logged({
              command: definition.name,
              surface: "mcp",
              ms: Date.now() - started,
              spends: true,
              failure: null,
              same: true,
            });
            return answered(
              definition,
              earlier,
              "The same call as one moments ago: this is its answer, and nothing was spent again.",
            );
          }
        }
        try {
          const answer = asObject(await command.run(input, options.context));
          if (!answer) {
            throw new Error(`${definition.name} answered something other than an object`);
          }
          if (key && options.sameCall) {
            await options.sameCall.store.put(key, answer, options.sameCall.seconds);
          }
          logged({
            command: definition.name,
            surface: "mcp",
            ms: Date.now() - started,
            spends: definition.spends,
            failure: null,
          });
          return answered(definition, answer);
        } catch (caught) {
          const failure = failureOf(caught);
          logged({
            command: definition.name,
            surface: "mcp",
            ms: Date.now() - started,
            spends: definition.spends,
            failure: failure?.kind ?? "error",
          });
          return {
            isError: true,
            content: [
              {
                type: "text",
                text:
                  failure?.message ?? (caught instanceof Error ? caught.message : String(caught)),
              },
            ],
          };
        }
      },
    );

    if (definition.app) {
      const uri = appUriOf(options.info.name, definition.name);
      const html = options.apps?.[definition.name];
      if (!html) {
        throw new Error(
          `${definition.name} has an app, but no page was given (apps.${definition.name})`,
        );
      }
      registerAppResource(
        server,
        definition.app.title,
        uri,
        { description: `${definition.about}, shown in the chat.` },
        () => ({ contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: html }] }),
      );
    }
    if (definition.resource) {
      const { resource } = definition;
      server.registerResource(
        definition.name,
        new ResourceTemplate(resource.uri, { list: undefined }),
        {
          title: resource.title,
          mimeType: "application/json",
          description: `${definition.about}.`,
        },
        async (uri, variables) => {
          const started = Date.now();
          const given = Object.fromEntries(
            Object.entries(variables).map(([name, value]) => [
              name,
              Array.isArray(value) ? value.join(",") : value,
            ]),
          );
          try {
            const answer = await command.run(definition.input.parse(given), options.context);
            logged({
              command: definition.name,
              surface: "resource",
              ms: Date.now() - started,
              spends: false,
              failure: null,
            });
            return {
              contents: [
                {
                  uri: uri.href,
                  mimeType: "application/json",
                  text: JSON.stringify(answer, null, 2),
                },
              ],
            };
          } catch (caught) {
            const failure = failureOf(caught);
            logged({
              command: definition.name,
              surface: "resource",
              ms: Date.now() - started,
              spends: false,
              failure: failure?.kind ?? "error",
            });
            if (failure?.kind === "not_found") {
              throw new ResourceNotFoundError(uri.href, failure.message);
            }
            throw caught;
          }
        },
      );
    }
  }
  return server;
}

// A tool's answer: its data, as structured content and as text, and, for work that goes on after
// the reply, a link to the resource that shows it.
function answered(
  definition: CommandDefinition,
  answer: Record<string, unknown>,
  note?: string,
): CallToolResult {
  // Compact: the same data as the structured answer, so as small as it can be (hosts cut answers
  // past a size: Claude's is about 150,000 characters).
  const content: Array<ContentBlock> = [{ type: "text", text: JSON.stringify(answer) }];
  if (note) {
    content.unshift({ type: "text", text: note });
  }
  const follow = definition.follow;
  const by = follow ? answer[follow.by] : undefined;
  if (follow && (typeof by === "string" || typeof by === "number")) {
    content.push({
      type: "resource_link",
      uri: follow.uri.replace(`{${follow.by}}`, encodeURIComponent(String(by))),
      name: `${follow.command} ${by}`,
      description: `Read this, or call ${follow.command}, to see the work come in.`,
      mimeType: "application/json",
    });
  }
  return { content, structuredContent: answer };
}

// The OpenAPI 3.1 document of every command with an API route: what it takes, what it answers,
// how it fails, and which need signing in. From the definitions and output schemas alone.
export function openApiOf(options: {
  title: string;
  version: string;
  server: string;
  commands: ReadonlyArray<AnyImplementation<never>>;
}) {
  const schema = (of: z.core.$ZodType) =>
    z.toJSONSchema(of, { io: "input", unrepresentable: "any", target: "draft-2020-12" });
  const paths: Record<string, Record<string, unknown>> = {};
  for (const { definition, output } of options.commands) {
    if (!definition.api) {
      continue;
    }
    const inPath = [...definition.api.path.matchAll(/\[([^\]]+)\]/g)].flatMap((match) =>
      match[1] ? [match[1]] : [],
    );
    const fields = Object.entries(definition.input.shape);
    const parameters = fields
      .filter(([name]) => inPath.includes(name) || definition.api?.method === "GET")
      .map(([name, field]) => ({
        name,
        in: inPath.includes(name) ? "path" : "query",
        required: inPath.includes(name) || !z.safeParse(field, undefined).success,
        schema: schema(field),
      }));
    const body = fields.filter(([name]) => !inPath.includes(name));
    const path = definition.api.path.replaceAll(/\[([^\]]+)\]/g, "{$1}");
    const failures = Object.fromEntries(
      Object.values(FAILURES).map(({ status }) => [
        String(status),
        {
          description: Object.entries(FAILURES).find(([, each]) => each.status === status)?.[0],
          content: { "text/plain": { schema: { type: "string" } } },
        },
      ]),
    );
    paths[path] = {
      ...paths[path],
      [definition.api.method.toLowerCase()]: {
        operationId: definition.name,
        summary: definition.about,
        ...(parameters.length > 0 ? { parameters } : {}),
        ...(definition.api.method === "POST" && body.length > 0
          ? {
              requestBody: {
                required: true,
                content: {
                  "application/json": {
                    schema: schema(
                      definition.input.omit(Object.fromEntries(inPath.map((name) => [name, true]))),
                    ),
                  },
                },
              },
            }
          : {}),
        responses: {
          "200": {
            description: "The answer",
            content: { "application/json": { schema: schema(output) } },
          },
          ...failures,
        },
        ...(definition.signedIn ? { security: [{ bearer: [] }] } : {}),
        ...(definition.spends ? { "x-spends": true } : {}),
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: { title: options.title, version: options.version },
    servers: [{ url: options.server }],
    paths,
    components: { securitySchemes: { bearer: { type: "http", scheme: "bearer" } } },
  };
}
