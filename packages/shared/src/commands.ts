// The app's commands, each written once (plan 2026-11-21-01): what it is, what it takes, where it
// is on each surface. Everything is made from these: the API routes and pages run them with
// `runCommand` (src/commands/context.ts), the MCP server lists them (src/mcp.ts), the CLI takes its
// flags and help from them (packages/cli), the docs' command reference and the agent skill print
// them, and `vp run mcp:check` asks them. The code that runs each one is beside it in the Worker
// (src/commands/), as `implement(definition, output, run)`. Nothing here runs a command, so the
// CLI and the docs can import it.
import { z } from "zod";
import {
  defineCommand,
  type CliShape,
  type CommandDefinition,
  type InputSchema,
} from "void-commands";
import { usageOf } from "void-commands/cli";
import type { RoutePath } from "void/routes";
import { PLACE_KINDS } from "@cloudflare-ping/shared/places";
import { DEFAULT_TARGET } from "@cloudflare-ping/shared/targets";

// A definition whose API path is one of the app's own routes: a typo doesn't compile.
const command = <
  const Name extends string,
  Input extends InputSchema,
  const Path extends RoutePath,
  const Cli extends CliShape<Input> | null,
>(
  definition: CommandDefinition<Name, Input, Path, Cli>,
) => defineCommand(definition);

// Where to test from: Globalping's "magic" field.
const from = z
  .string()
  .min(1)
  .describe(
    "Where the probes are: a country code (TH), a city, a region, or a network (AS13335), as places finds them",
  );

export const test = command({
  name: "test",
  about: "One test, to our probe or straight to a target",
  input: z.object({
    from,
    // A pattern, not `startsWith`, whose JSON Schema form ("format": "starts_with") isn't standard.
    path: z
      .string()
      .regex(/^\//, "A path starts with /")
      .describe("The path the probes fetch: /where answers which data centre it ran in"),
    probes: z.number().int().min(1).max(10).describe("How many probes: each is one test's worth"),
    host: z
      .string()
      .optional()
      .describe("A target on the allowed list to fetch directly; our own probe unless given"),
  }),
  api: { method: "POST", path: "/api/probe" },
  page: "/",
  task: "probe:test",
  signedIn: true,
  spends: true,
  mcp: true,
  cli: {
    argument: null,
    flags: {
      from: { type: "string", default: "TH", help: "Where the probes are", hint: "TH" },
      path: { type: "string", default: "/where", help: "The path they fetch", hint: "/where" },
      probes: { type: "string", default: "1", help: "How many probes", hint: "1" },
      host: { type: "string", help: "A target on the allowed list, instead of our probe" },
    },
  },
});

export const run = command({
  name: "run",
  about:
    "Start a run and follow its fetches as they're recorded; everywhere: from every data centre the map reached",
  input: z.object({
    target: z
      .url({ protocol: /^https$/ })
      .describe("The address to fetch, from the allowed list (packages/shared/src/targets.ts)"),
    from,
    probes: z.number().int().min(1).max(10).describe("How many probes"),
    repeat: z.number().int().min(1).max(5).describe("How many fetches each probe's request makes"),
    background: z
      .boolean()
      .describe("Answer as soon as the probes reach us, and fetch afterwards (true), or wait"),
    // From every data centre the map reached, one probe each (plan step 8), instead of `from` and
    // `probes`; in the background. `at`: only these data centres, to try one first.
    everywhere: z
      .object({
        map: z.string().min(8).max(64).optional().describe("Which map: the newest unless given"),
        at: z
          .array(
            z.string().regex(/^[A-Za-z]{3}$/, "A data centre's three-letter code, such as BKK"),
          )
          .max(400)
          .optional()
          .describe("Only these data centres"),
      })
      .optional()
      .describe("One probe in each data centre the map reached, instead of from and probes"),
  }),
  api: { method: "POST", path: "/api/runs" },
  page: "/runs",
  task: "ping:run",
  signedIn: true,
  spends: true,
  mcp: true,
  cli: {
    argument: null,
    flags: {
      target: {
        type: "string",
        default: DEFAULT_TARGET,
        help: "The address to fetch",
        hint: "<url>",
      },
      from: { type: "string", default: "TH", help: "Where the probes are", hint: "TH" },
      probes: { type: "string", default: "2", help: "How many probes", hint: "2" },
      repeat: { type: "string", default: "1", help: "Fetches per probe", hint: "1" },
      inline: { type: "boolean", default: false, help: "Fetch before answering" },
      everywhere: {
        type: "boolean",
        default: false,
        help: "One probe in each data centre the map reached",
      },
      at: { type: "string", help: "With --everywhere: only these data centres", hint: "BKK,SIN" },
    },
  },
  follow: { command: "show", by: "id", uri: "cloudflare-ping://runs/{id}" },
});

export const runs = command({
  name: "runs",
  about: "The newest runs",
  input: z.object({
    cursor: z.string().max(200).optional().describe("Carry on from here: the last answer's next"),
    limit: z.coerce.number().int().min(1).max(200).optional().describe("At most this many (50)"),
  }),
  api: { method: "GET", path: "/api/runs" },
  page: "/runs",
  task: "ping:runs",
  signedIn: false,
  spends: false,
  mcp: true,
  cli: {
    argument: null,
    flags: {
      cursor: { type: "string", help: "Carry on from the last answer's next" },
      limit: { type: "string", help: "At most this many", hint: "50" },
    },
  },
});

export const show = command({
  name: "show",
  about: "One run and its fetches",
  input: z.object({
    id: z.string().min(1).max(64).describe("The run's ID, as runs and run answer it"),
  }),
  api: { method: "GET", path: "/api/runs/[id]" },
  page: "/runs/<id>",
  task: "ping:show",
  signedIn: false,
  spends: false,
  mcp: true,
  cli: { argument: "id", flags: {} },
  resource: { uri: "cloudflare-ping://runs/{id}", title: "A run and its fetches" },
});

export const limits = command({
  name: "limits",
  about: "How many tests the app has left this hour",
  input: z.object({}),
  api: { method: "GET", path: "/api/limits" },
  page: "/runs",
  task: "ping:limits",
  signedIn: false,
  spends: false,
  mcp: true,
  cli: { argument: null, flags: {} },
});

export const places = command({
  name: "places",
  about:
    "Find a place to test from: continents, regions, countries, US states, cities and networks with probes, and Cloudflare's data centres",
  input: z.object({
    q: z
      .string()
      .max(100)
      .optional()
      .describe('What\'s typed: "bang", "TH", "AS13335", "virginia"'),
    kind: z.enum(PLACE_KINDS).optional().describe("Only places of this kind"),
    // Not given: with something typed, the best 50; with nothing, every place (the picker's).
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(10_000)
      .optional()
      .describe("At most this many, best first: 50 with something typed, every place without"),
    cursor: z.string().max(200).optional().describe("Carry on from here: the last answer's next"),
  }),
  api: { method: "GET", path: "/api/places" },
  page: "/",
  task: "ping:places",
  signedIn: false,
  spends: false,
  mcp: true,
  cli: {
    argument: "q",
    flags: {
      kind: { type: "string", help: `One of: ${PLACE_KINDS.join(", ")}` },
      limit: { type: "string", help: "At most this many" },
      cursor: { type: "string", help: "Carry on from the last answer's next" },
    },
  },
});

// The coverage command's options (plan 2026-11-20-04, "One filter, everywhere"): the page's
// address, the API's query, the CLI's flags and the MCP tool's arguments, with one set of
// defaults, applied in the command. void.config.ts reads its keys: the page cache keeps one page
// per value.
export const coverageOptions = z.object({
  // One place, a continent or a country, never both. Anything, so that what a visitor types never
  // ends on an error page.
  place: z
    .string()
    .max(60)
    .optional()
    .describe(
      'One continent or country: a country by its code ("TH"), a continent by its name ("Europe"); blank for everywhere',
    ),
  // True or false from an agent; "true" or "false" in an address.
  cities: z
    .union([z.boolean(), z.stringbool()])
    .optional()
    .describe("Every probe city too (true unless false); false for just the totals and the table"),
});

export const COVERAGE_OPTION_KEYS = Object.keys(coverageOptions.shape);

export const coverage = command({
  name: "coverage",
  about: "All of Cloudflare's data centres and every probe, on a world map",
  input: coverageOptions,
  api: { method: "GET", path: "/api/coverage" },
  page: "/coverage",
  task: "ping:coverage",
  signedIn: false,
  spends: false,
  mcp: true,
  cli: {
    argument: null,
    flags: {
      place: { type: "string", help: "One continent or country", hint: "Europe|TH" },
      cities: { type: "boolean", help: "Every probe city too; --no-cities for just the totals" },
    },
  },
});

export const map = command({
  name: "map",
  about: "Which Cloudflare data centres the probes reach, and what it cost to find out",
  input: z.object({
    id: z.string().min(8).max(64).optional().describe("Which map: the newest unless given"),
  }),
  api: { method: "GET", path: "/api/map" },
  page: "/map",
  task: "ping:map",
  signedIn: false,
  spends: false,
  mcp: true,
  cli: {
    argument: null,
    flags: { id: { type: "string", help: "Which map; the newest unless given" } },
  },
  resource: { uri: "cloudflare-ping://maps/{id}", title: "A map" },
});

export const remap = command({
  name: "remap",
  about: "Start a new map: one test per place, worked through on a queue",
  input: z.object({
    level: z
      .enum(["country", "city"])
      .describe("One probe per country (about 120 tests for the world), or per city (about 1,100)"),
    countries: z
      .array(z.string().regex(/^[A-Za-z]{2}$/, "A country's two-letter code, such as TH"))
      .max(50)
      .optional()
      .describe("Only these countries, by code (TH, SG): a small map, to try it"),
  }),
  api: { method: "POST", path: "/api/map" },
  page: "/map",
  task: "ping:remap",
  signedIn: true,
  spends: true,
  mcp: true,
  cli: {
    argument: null,
    flags: {
      level: { type: "string", default: "country", help: "country or city", hint: "country|city" },
      countries: { type: "string", help: "Only these countries", hint: "TH,SG" },
    },
  },
  follow: { command: "map", by: "id", uri: "cloudflare-ping://maps/{id}" },
});

export const trace = command({
  name: "trace",
  about: "A request's Cloudflare log, by its cf-ray",
  input: z.object({
    ray: z
      .string()
      .regex(/^[0-9a-f]{16}(-[A-Z]{3})?$/)
      .describe("The request's cf-ray, with or without its data centre (a5cf35412be9a955-BKK)"),
    // In a URL's query it arrives as text.
    minutes: z.coerce
      .number()
      .int()
      .min(1)
      .max(10_080)
      .optional()
      .describe("How far back to look, in minutes, up to a week (60)"),
  }),
  api: { method: "GET", path: "/api/trace/[ray]" },
  page: "/trace/<ray>",
  task: "probe:trace",
  signedIn: true,
  spends: false,
  mcp: true,
  cli: {
    argument: "ray",
    flags: { minutes: { type: "string", default: "60", help: "How far back to look", hint: "60" } },
  },
});

// The commands that are only the CLI's: setting a project up, and signing this machine in and out.
const ofTheCli = <const Name extends string>(
  name: Name,
  about: string,
  page: string,
  task: string | null,
) =>
  defineCommand({
    name,
    about,
    input: z.object({}),
    api: null,
    page,
    task,
    signedIn: false,
    spends: false,
    mcp: false,
    cli: { argument: null, flags: {} },
  });

export const init = ofTheCli(
  "init",
  "Set this project's coding agents up to use the app: its skill, its MCP server",
  "/docs/agents",
  null,
);
export const signIn = ofTheCli("sign-in", "Sign this machine in", "/login", "ping:sign-in");
export const signOut = ofTheCli("sign-out", "Sign this machine out", "Sign out", "ping:sign-out");
export const whoami = ofTheCli(
  "whoami",
  "Who this machine is signed in as",
  "the top bar",
  "ping:whoami",
);

// Every command, in the order the help and the docs list them.
export const COMMAND_LIST = [
  test,
  run,
  runs,
  show,
  limits,
  places,
  coverage,
  map,
  remap,
  trace,
  init,
  signIn,
  signOut,
  whoami,
] as const;

export type AnyCommand = (typeof COMMAND_LIST)[number];

// What the help, the docs and the skill print for a command.
export const usage = (definition: AnyCommand) => usageOf(definition);

// How the API route is written for people: `GET /api/runs/<id>`.
export const apiOf = (definition: AnyCommand) =>
  definition.api
    ? `${definition.api.method} ${definition.api.path.replaceAll(/\[([^\]]+)\]/g, "<$1>")}`
    : definition.name === "init"
      ? "none: files in this folder"
      : "Void's auth";

// What every command takes: the help's and the docs' last words.
export const COMMON_OPTIONS = [
  "Every command takes --site <url> (another copy of the app; the deployed one unless given), and those that print results take --json.",
];

// The commands that need this machine signed in, from their `signedIn`.
export const SIGNED_IN_COMMANDS = COMMAND_LIST.filter((each) => each.signedIn).map(
  (each) => each.name,
);

// One question to a command, as each surface takes it, written once as the command's options. The
// MCP tool takes the options as they are. The API takes them in its route (`[id]` from id) and the
// rest as its query. The CLI takes the bare argument (`cli.argument`), then `--option value`, with
// `--option` for true and `--no-option` for false. How `vp run mcp:check` asks the three the same.
export function questionFor(
  definition: AnyCommand,
  options: Record<string, string | number | boolean>,
) {
  const query = new URLSearchParams();
  let path: string = definition.api?.path ?? "";
  const bare: Array<string> = [];
  const flags: Array<string> = [];
  for (const [key, value] of Object.entries(options)) {
    const text = String(value);
    if (path.includes(`[${key}]`)) {
      path = path.replace(`[${key}]`, encodeURIComponent(text));
    } else {
      query.set(key, text);
    }
    if (key === definition.cli?.argument) {
      bare.push(text);
    } else if (typeof value === "boolean") {
      flags.push(value ? `--${key}` : `--no-${key}`);
    } else {
      flags.push(`--${key}`, text);
    }
  }
  const search = query.toString();
  return {
    method: definition.api?.method ?? "GET",
    path: search ? `${path}?${search}` : path,
    cli: [definition.name, ...bare, ...flags],
  };
}

// How signing in works: in the help, the skill, and the docs under "Signing in".
export const SIGNING_IN = `These need this machine signed in: ${SIGNED_IN_COMMANDS.join(", ")}. The first time, the command prints a link and a code: open the link, approve the code, and it carries on. If the sign-in has expired, it asks again. cloudflare-ping whoami shows whether you're signed in. In CI, set CLOUDFLARE_PING_TOKEN instead.`;
