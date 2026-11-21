// The MCP server as a client sees it, with the official SDK on both sides: the client's HTTP
// transport talks to the server's own `createMcpHandler`, as on a Worker, with its fetch handed
// straight to the handler instead of the network. No mocks: the same code paths as `/mcp`.
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { CfWorkerJsonSchemaValidator } from "@modelcontextprotocol/server/validators/cf-worker";
import { describe, expect, it } from "vite-plus/test";
import { z } from "zod";
import { defineCommand } from "void-commands";
import {
  commandsMcpServer,
  fail,
  implementer,
  openApiOf,
  type SameCallStore,
} from "void-commands/server";

const implement = implementer<{ spent: Array<string> }>();

const things = new Map([["a1", { id: "a1", name: "The first" }]]);

const look = implement(
  defineCommand({
    name: "look",
    about: "One thing",
    input: z.object({ id: z.string().describe("The thing's ID") }),
    api: { method: "GET", path: "/api/things/[id]" },
    page: null,
    task: null,
    signedIn: false,
    spends: false,
    mcp: true,
    cli: { argument: "id", flags: {} },
    resource: { uri: "test://things/{id}", title: "A thing" },
  }),
  z.object({ id: z.string(), name: z.string() }),
  ({ id }) => things.get(id) ?? fail("not_found", `No such thing: ${id}`),
);

const make = implement(
  defineCommand({
    name: "make",
    about: "Make a thing",
    input: z.object({ name: z.string().min(1).describe("What to call it") }),
    api: { method: "POST", path: "/api/things" },
    page: null,
    task: null,
    signedIn: true,
    spends: true,
    mcp: true,
    cli: null,
    follow: { command: "look", by: "id", uri: "test://things/{id}" },
  }),
  z.object({ id: z.string(), name: z.string() }),
  ({ name }, context) => {
    context.spent.push(name);
    const id = `t${context.spent.length}`;
    things.set(id, { id, name });
    return { id, name };
  },
);

function memoryStore(): SameCallStore {
  const kept = new Map<string, unknown>();
  return {
    get: async (key) => kept.get(key) ?? null,
    put: async (key, value) => {
      kept.set(key, value);
    },
  };
}

// A client of a fresh server, signed in with these scopes; `answer` is what its user says when
// asked, on MCP 2026-07-28, where a stateless server can ask (none: a 2025 client, which can't).
async function connect(options: { scopes: Array<string>; answer?: boolean }) {
  const context: { spent: Array<string> } = { spent: [] };
  const store = memoryStore();
  const handler = createMcpHandler(() =>
    commandsMcpServer({
      info: { name: "test", version: "1" },
      commands: [look, make],
      context,
      caller: { client: "client-1", user: "user-1", scopes: options.scopes },
      spendScope: "spend",
      spending: "credits",
      sameCall: { store, seconds: 120 },
      askBeforeSpending: async () => "This spends a credit. Go ahead?",
      serverOptions: { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() },
    }),
  );
  const client = new Client(
    { name: "test client", version: "1" },
    options.answer === undefined
      ? {}
      : {
          capabilities: { elicitation: { form: {} } },
          versionNegotiation: { mode: { pin: "2026-07-28" } },
        },
  );
  if (options.answer !== undefined) {
    const go = options.answer;
    client.setRequestHandler("elicitation/create", async () => ({
      action: "accept",
      content: { go },
    }));
  }
  const transport = new StreamableHTTPClientTransport(new URL("http://test/mcp"), {
    fetch: (url, init) =>
      handler.fetch(new Request(url, init), {
        authInfo: { token: "t", clientId: "client-1", scopes: options.scopes },
      }),
  });
  await client.connect(transport);
  return { client, context };
}

describe("commandsMcpServer", () => {
  it("lists a tool per command, with what it takes and what it answers", async () => {
    const { client } = await connect({ scopes: [] });
    const { tools } = await client.listTools();
    expect(tools.map((each) => each.name)).toEqual(["look", "make"]);
    const found = tools.find((each) => each.name === "look");
    expect(found?.annotations?.readOnlyHint).toBe(true);
    expect(found?.inputSchema.properties?.id).toMatchObject({ description: "The thing's ID" });
    expect(found?.outputSchema?.properties).toHaveProperty("name");
    const spending = tools.find((each) => each.name === "make");
    expect(spending?.annotations?.readOnlyHint).toBe(false);
    expect(spending?.description).toContain("It spends credits");
  });

  it("answers with structured content, and a failure in the command's own words", async () => {
    const { client } = await connect({ scopes: [] });
    const found = await client.callTool({ name: "look", arguments: { id: "a1" } });
    expect(found.structuredContent).toEqual({ id: "a1", name: "The first" });
    const missing = await client.callTool({ name: "look", arguments: { id: "zz" } });
    expect(missing.isError).toBe(true);
    expect(missing.content).toEqual([{ type: "text", text: "No such thing: zz" }]);
  });

  it("refuses a command that spends to a token without the scope", async () => {
    const { client, context } = await connect({ scopes: [] });
    await expect(client.callTool({ name: "make", arguments: { name: "x" } })).rejects.toThrow();
    expect(context.spent).toEqual([]);
  });

  it("asks before spending, and spends once for the same call twice", async () => {
    const { client, context } = await connect({ scopes: ["spend"], answer: true });
    const first = await client.callTool({ name: "make", arguments: { name: "two" } });
    expect(first.structuredContent).toMatchObject({ name: "two" });
    expect(first.content).toContainEqual(
      expect.objectContaining({ type: "resource_link", uri: "test://things/t1" }),
    );
    const again = await client.callTool({ name: "make", arguments: { name: "two" } });
    expect(again.structuredContent).toEqual(first.structuredContent);
    expect(context.spent).toEqual(["two"]);
  });

  it("doesn't start when the user says no", async () => {
    const { client, context } = await connect({ scopes: ["spend"], answer: false });
    const refused = await client.callTool({ name: "make", arguments: { name: "no" } });
    expect(refused.isError).toBe(true);
    expect(context.spent).toEqual([]);
  });

  it("runs without asking when the client can't ask", async () => {
    const { client, context } = await connect({ scopes: ["spend"] });
    await client.callTool({ name: "make", arguments: { name: "quiet" } });
    expect(context.spent).toEqual(["quiet"]);
  });

  it("serves a command as a resource too", async () => {
    const { client } = await connect({ scopes: [] });
    const read = await client.readResource({ uri: "test://things/a1" });
    const [first] = read.contents;
    expect(first && "text" in first ? JSON.parse(first.text) : null).toEqual({
      id: "a1",
      name: "The first",
    });
  });
});

describe("openApiOf", () => {
  it("describes each route: its path, inputs, answer and sign-in", () => {
    const document = openApiOf({
      title: "test",
      version: "1",
      server: "http://test",
      commands: [look, make],
    });
    expect(document.paths["/api/things/{id}"]?.get).toMatchObject({
      operationId: "look",
      parameters: [{ name: "id", in: "path", required: true }],
    });
    expect(document.paths["/api/things"]?.post).toMatchObject({
      operationId: "make",
      security: [{ bearer: [] }],
      requestBody: { required: true },
    });
  });
});
