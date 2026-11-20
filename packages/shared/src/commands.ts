// The commands, as `cloudflare-ping help` lists them and the docs' command reference shows them
// (docs/cli.data.ts): one list, so the two never differ. What each one runs is in packages/cli/main.ts.
export type CommandInfo = {
  name: string;
  use: string;
  about: string;
  // Where the web does the same.
  page: string;
  // The API route it calls.
  api: string;
  // The `vp run` task that runs it from source, in the repo, if it has one.
  task: string | null;
  // Its MCP tool (src/mcp.ts), if it has one: signing in and out is the MCP client's own.
  tool: string | null;
  // Whether it needs this machine signed in. The one place that decides: its API route and its
  // page enforce what this says (src/commands/context.ts, `signedInFor`), and the docs
  // and `cloudflare-ping help` show it from here.
  signedIn: boolean;
  // Whether it spends tests: only an explicit test, run or new map does, never coverage, places or
  // a picker. Its MCP tool is marked by it (src/mcp.ts), the docs, `cloudflare-ping help` and the
  // skill show it, and `vp run mcp:check` never calls it.
  spends: boolean;
  // Which of its options the CLI's bare argument fills (`places bang`: q), if it takes one. With
  // it, one question becomes each surface's (`questionFor`).
  argument: string | null;
};

export const COMMAND_LIST: Array<CommandInfo> = [
  {
    name: "test",
    use: "test [--from TH] [--path /where] [--probes 1] [--host <target>]",
    about: "One test, to our probe or straight to a target",
    page: "/",
    api: "POST /api/probe",
    task: "probe:test",
    tool: "test",
    signedIn: true,
    spends: true,
    argument: null,
  },
  {
    name: "run",
    use: "run [--target <url>] [--from TH] [--probes 2] [--repeat 1] [--inline] [--everywhere [--at BKK,SIN]]",
    about:
      "Start a run and follow its fetches as they're recorded; --everywhere: from every data centre the map reached",
    page: "/runs",
    api: "POST /api/runs",
    task: "ping:run",
    tool: "run",
    signedIn: true,
    spends: true,
    argument: null,
  },
  {
    name: "runs",
    use: "runs",
    about: "The newest runs",
    page: "/runs",
    api: "GET /api/runs",
    task: "ping:runs",
    tool: "runs",
    signedIn: false,
    spends: false,
    argument: null,
  },
  {
    name: "show",
    use: "show <run id>",
    about: "One run and its fetches",
    page: "/runs/<id>",
    api: "GET /api/runs/<id>",
    task: "ping:show",
    tool: "show",
    signedIn: false,
    spends: false,
    argument: "id",
  },
  {
    name: "limits",
    use: "limits",
    about: "How many tests the app has left this hour",
    page: "/runs",
    api: "GET /api/limits",
    task: "ping:limits",
    tool: "limits",
    signedIn: false,
    spends: false,
    argument: null,
  },
  {
    name: "places",
    use: "places [<what>] [--kind <kind>] [--limit <n>]",
    about:
      "Find a place to test from: continents, regions, countries, US states, cities and networks with probes, and Cloudflare's data centres",
    page: "/",
    api: "GET /api/places",
    task: "ping:places",
    tool: "places",
    signedIn: false,
    spends: false,
    argument: "q",
  },
  {
    name: "coverage",
    use: "coverage [--place Europe|TH] [--no-cities]",
    about: "All of Cloudflare's data centres and every probe, on a world map",
    page: "/coverage",
    api: "GET /api/coverage",
    task: "ping:coverage",
    tool: "coverage",
    signedIn: false,
    spends: false,
    argument: null,
  },
  {
    name: "map",
    use: "map [--id <map id>]",
    about: "Which Cloudflare data centres the probes reach, and what it cost to find out",
    page: "/map",
    api: "GET /api/map",
    task: "ping:map",
    tool: "map",
    signedIn: false,
    spends: false,
    argument: null,
  },
  {
    name: "remap",
    use: "remap [--level country|city] [--countries TH,SG]",
    about: "Start a new map: one test per place, worked through on a queue",
    page: "/map",
    api: "POST /api/map",
    task: "ping:remap",
    tool: "remap",
    signedIn: true,
    spends: true,
    argument: null,
  },
  {
    name: "trace",
    use: "trace <ray id> [--minutes 60]",
    about: "A request's Cloudflare log, by its cf-ray",
    page: "/trace/<ray>",
    api: "GET /api/trace/<ray>",
    task: "probe:trace",
    tool: "trace",
    signedIn: true,
    spends: false,
    argument: "ray",
  },
  {
    name: "init",
    use: "init",
    about: "Set this project's coding agents up to use the app: its skill, its MCP server",
    page: "/docs/agents",
    api: "none: files in this folder",
    task: null,
    tool: null,
    signedIn: false,
    spends: false,
    argument: null,
  },
  {
    name: "sign-in",
    use: "sign-in",
    about: "Sign this machine in",
    page: "/login",
    api: "Void's auth",
    task: "ping:sign-in",
    tool: null,
    signedIn: false,
    spends: false,
    argument: null,
  },
  {
    name: "sign-out",
    use: "sign-out",
    about: "Sign this machine out",
    page: "Sign out",
    api: "Void's auth",
    task: "ping:sign-out",
    tool: null,
    signedIn: false,
    spends: false,
    argument: null,
  },
  {
    name: "whoami",
    use: "whoami",
    about: "Who this machine is signed in as",
    page: "the top bar",
    api: "Void's auth",
    task: "ping:whoami",
    tool: null,
    signedIn: false,
    spends: false,
    argument: null,
  },
];

// What every command takes: the help's and the docs' last words.
export const COMMON_OPTIONS = [
  "Every command takes --site <url> (another copy of the app; the deployed one unless given), and those that print results take --json.",
];

// The commands that need this machine signed in, from their `signedIn`.
export const SIGNED_IN_COMMANDS = COMMAND_LIST.filter((each) => each.signedIn).map(
  (each) => each.name,
);

// One question to a command, as each surface takes it, written once as the command's options. The
// MCP tool takes the options as they are. The API takes them in its route (`<id>` from id) and the
// rest as its query. The CLI takes the bare argument (`argument`), then `--option value`, with
// `--option` for true and `--no-option` for false. How `vp run mcp:check` asks the three the same.
export function questionFor(
  command: CommandInfo,
  options: Record<string, string | number | boolean>,
) {
  const [method = "GET", route = ""] = command.api.split(" ");
  const query = new URLSearchParams();
  let path = route;
  const bare: Array<string> = [];
  const flags: Array<string> = [];
  for (const [key, value] of Object.entries(options)) {
    const text = String(value);
    if (path.includes(`<${key}>`)) {
      path = path.replace(`<${key}>`, encodeURIComponent(text));
    } else {
      query.set(key, text);
    }
    if (key === command.argument) {
      bare.push(text);
    } else if (typeof value === "boolean") {
      flags.push(value ? `--${key}` : `--no-${key}`);
    } else {
      flags.push(`--${key}`, text);
    }
  }
  const search = query.toString();
  return {
    method,
    path: search ? `${path}?${search}` : path,
    cli: [command.name, ...bare, ...flags],
  };
}

// How signing in works: in the help, the skill, and the docs under "Signing in".
export const SIGNING_IN = `These need this machine signed in: ${SIGNED_IN_COMMANDS.join(", ")}. The first time, the command prints a link and a code: open the link, approve the code, and it carries on. If the sign-in has expired, it asks again. cloudflare-ping whoami shows whether you're signed in. In CI, set CLOUDFLARE_PING_TOKEN instead.`;
