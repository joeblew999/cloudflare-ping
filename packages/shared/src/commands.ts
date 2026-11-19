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
  // The `vp run` task that runs it from source, in the repo.
  task: string;
};

export const COMMAND_LIST: Array<CommandInfo> = [
  {
    name: "test",
    use: "test [--from TH] [--path /where] [--probes 1] [--host <target>]",
    about: "One Globalping test, to our probe or straight to a target",
    page: "/",
    api: "POST /api/probe",
    task: "probe:test",
  },
  {
    name: "run",
    use: "run [--target <url>] [--from TH] [--probes 2] [--repeat 1] [--inline]",
    about: "Start a run and follow its fetches as they're recorded",
    page: "/runs",
    api: "POST /api/runs",
    task: "ping:run",
  },
  {
    name: "runs",
    use: "runs",
    about: "The newest runs",
    page: "/runs",
    api: "GET /api/runs",
    task: "ping:runs",
  },
  {
    name: "show",
    use: "show <run id>",
    about: "One run and its fetches",
    page: "/runs/<id>",
    api: "GET /api/runs/<id>",
    task: "ping:show",
  },
  {
    name: "trace",
    use: "trace <ray id> [--minutes 60]",
    about: "A request's Cloudflare log, by its cf-ray",
    page: "/trace/<ray>",
    api: "GET /api/trace/<ray>",
    task: "probe:trace",
  },
  {
    name: "sign-in",
    use: "sign-in",
    about: "Sign this machine in",
    page: "/login",
    api: "Void's auth",
    task: "ping:sign-in",
  },
  {
    name: "sign-out",
    use: "sign-out",
    about: "Sign this machine out",
    page: "Sign out",
    api: "Void's auth",
    task: "ping:sign-out",
  },
  {
    name: "whoami",
    use: "whoami",
    about: "Who this machine is signed in as",
    page: "the top bar",
    api: "Void's auth",
    task: "ping:whoami",
  },
];

// What every command takes, and how signing in works: the help's and the docs' last words.
export const COMMON_OPTIONS = [
  "Every command takes --site <url> (another copy of the app; the deployed one unless given), and those that print results take --json.",
  "Signing in: the first command that needs it shows a link and a code to approve in the browser. In CI, set CLOUDFLARE_PING_TOKEN.",
];
