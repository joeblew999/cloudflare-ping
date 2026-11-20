// The commands, as `cloudflare-ping help` lists them and the docs' command reference shows them
// (apps/docs/cli.data.ts): one list, so the two never differ. What each one runs is in packages/cli/main.ts.
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
  // Its MCP tool (apps/web/src/mcp.ts), if it has one: signing in and out is the MCP client's own.
  tool: string | null;
  // Whether it needs this machine signed in. The one place that decides: its API route and its
  // page enforce what this says (apps/web/src/commands/context.ts, `signedInFor`), and the docs
  // and `cloudflare-ping help` show it from here.
  signedIn: boolean;
};

export const COMMAND_LIST: Array<CommandInfo> = [
  {
    name: "test",
    use: "test [--from TH] [--path /where] [--probes 1] [--host <target>]",
    about: "One Globalping test, to our probe or straight to a target",
    page: "/",
    api: "POST /api/probe",
    task: "probe:test",
    tool: "test",
    signedIn: true,
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
  },
  {
    name: "limits",
    use: "limits",
    about: "How many Globalping tests the app has left this hour",
    page: "/runs",
    api: "GET /api/limits",
    task: "ping:limits",
    tool: "limits",
    signedIn: false,
  },
  {
    name: "places",
    use: "places [<what>] [--kind <kind>] [--limit <n>]",
    about:
      "Find a place to test from: continents, regions, countries, US states, cities and networks with Globalping's probes, and Cloudflare's data centres",
    page: "/",
    api: "GET /api/places",
    task: "ping:places",
    tool: "places",
    signedIn: false,
  },
  {
    name: "coverage",
    use: "coverage [--country TH]",
    about: "All of Cloudflare's data centres and Globalping's probes, on a world map",
    page: "/coverage",
    api: "GET /api/coverage",
    task: "ping:coverage",
    tool: "coverage",
    signedIn: false,
  },
  {
    name: "map",
    use: "map [--id <map id>]",
    about: "Which Cloudflare data centres Globalping's probes reach, and what it cost to find out",
    page: "/map",
    api: "GET /api/map",
    task: "ping:map",
    tool: "map",
    signedIn: false,
  },
  {
    name: "remap",
    use: "remap [--level country|city] [--countries TH,SG]",
    about: "Start a new map: one Globalping test per place, worked through on a queue",
    page: "/map",
    api: "POST /api/map",
    task: "ping:remap",
    tool: "remap",
    signedIn: true,
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

// How signing in works: in the help, the skill, and the docs under "Signing in".
export const SIGNING_IN = `These need this machine signed in: ${SIGNED_IN_COMMANDS.join(", ")}. The first time, the command prints a link and a code: open the link, approve the code, and it carries on. If the sign-in has expired, it asks again. cloudflare-ping whoami shows whether you're signed in. In CI, set CLOUDFLARE_PING_TOKEN instead.`;
