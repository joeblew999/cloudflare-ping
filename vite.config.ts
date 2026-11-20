// The repo's Vite+ config (Vite+'s monorepo guide: one root config for lint, format, staged checks
// and the repo's tasks; each package keeps its own vite.config.ts for what it builds: apps/web
// Void, packages/cli `vp pack`).
import { defineConfig } from "vite-plus";
import { voidRules } from "./lint/void-rules";

export default defineConfig({
  // `vp dev`, `vp build` and `vp preview` at the root mean the app; `vp pack`, the CLI.
  defaultPackage: {
    dev: "./apps/web",
    build: "./apps/web",
    preview: "./apps/web",
    pack: "./packages/cli",
  },
  // Each commit's staged files, checked and fixed (`vp config` sets the hook up, on install).
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    // Void's own settings (lint/void-rules.ts names the commit): its default category off and
    // every rule listed, its plugins and environments, and its vite-plus plugin.
    categories: { correctness: "off" },
    env: { browser: true, builtin: true, es2024: true, node: true },
    plugins: ["typescript", "import", "react", "unicorn", "vitest", "node", "jsdoc", "oxc"],
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    options: { typeAware: true, typeCheck: true },
    rules: {
      // Void's own list, whole. This repo's rules come after it.
      ...voidRules,
      // Ours, as joeblew999/void-fbtee's: every type from a real source, never from code saying
      // so. No casts (`as const` is fine), no value used as `any`, no `!` (lookups are "maybe
      // nothing" too: noUncheckedIndexedAccess in the tsconfigs).
      "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],
      "typescript/no-unsafe-assignment": "error",
      "typescript/no-unsafe-member-access": "error",
      "typescript/no-unsafe-call": "error",
      "typescript/no-unsafe-return": "error",
      "typescript/no-unsafe-argument": "error",
      "typescript/no-non-null-assertion": "error",
    },
  },
  fmt: {
    // Written by tools, not by hand: drizzle (migrations), Void (AGENTS.md), and the CLI's skill
    // (packages/cli/write-skill.ts, from the commands list).
    ignorePatterns: ["**/db/migrations/**", "**/AGENTS.md", "packages/cli/skills/**"],
  },
  run: {
    // The repo's tasks, from anywhere in it. The CLI's commands run from source (packages/cli),
    // each calling the app's API as its page does (the README's table); the package's built file
    // runs the same ones anywhere.
    tasks: {
      // Any command: `vp run cli -- <command> [options]`.
      cli: { command: "vpx packages/cli/main.ts", cache: false },
      // One Globalping test (`POST /api/probe`): the home page's "Run a probe".
      "probe:test": { command: "vpx packages/cli/main.ts test", cache: false },
      // A request's Cloudflare log, by ray ID (`GET /api/trace/<ray>`): /trace/<ray>.
      "probe:trace": { command: "vpx packages/cli/main.ts trace", cache: false },
      // Start a run and follow its fetches (`POST /api/runs`): the Runs page's "Start a run".
      "ping:run": { command: "vpx packages/cli/main.ts run", cache: false },
      // The newest runs (`GET /api/runs`): the Runs page's list.
      "ping:runs": { command: "vpx packages/cli/main.ts runs", cache: false },
      // One run and its fetches (`GET /api/runs/<id>`): /runs/<id>.
      "ping:show": { command: "vpx packages/cli/main.ts show", cache: false },
      // Globalping tests left this hour, as the Worker sees it (`GET /api/limits`): the Runs page.
      "ping:limits": { command: "vpx packages/cli/main.ts limits", cache: false },
      // The coverage map's real-system check: the three real sources, through the app's own
      // reducing code; `-- --site <url>` checks that site's /api/coverage too.
      "coverage:check": { command: "vpx apps/web/scripts/coverage-check.ts", cache: false },
      // Places to test from (`GET /api/places`): what the forms' place picker offers.
      "ping:places": { command: "vpx packages/cli/main.ts places", cache: false },
      // The geographical coverage map's data (`GET /api/coverage`): the Coverage page.
      "ping:coverage": { command: "vpx packages/cli/main.ts coverage", cache: false },
      // The map (`GET /api/map`), and a new one (`POST /api/map`): the Map page.
      "ping:map": { command: "vpx packages/cli/main.ts map", cache: false },
      "ping:remap": { command: "vpx packages/cli/main.ts remap", cache: false },
      // Sign this machine in, out, and who it's signed in as: /login, "Sign out", the top bar.
      "ping:sign-in": { command: "vpx packages/cli/main.ts sign-in", cache: false },
      "ping:sign-out": { command: "vpx packages/cli/main.ts sign-out", cache: false },
      "ping:whoami": { command: "vpx packages/cli/main.ts whoami", cache: false },
      // The CLI package: build it (packages/cli/dist/main.mjs), and try the built file.
      "cli:pack": { command: "vp run cloudflare-ping#build", cache: false },
      "cli:try": { command: "node packages/cli/dist/main.mjs", cache: false },
      // The docs (apps/docs): write them with docs:dev (VitePress's own server); docs:build puts
      // them in apps/web/public/docs, where the app serves them at /docs/.
      "docs:dev": { command: "vp run docs#dev", cache: false },
      "docs:build": { command: "vp run docs#build", cache: false },
      "docs:preview": { command: "vp run docs#preview", cache: false },
      // Deploy the app and its docs (apps/web: `void deploy`, which builds both first).
      deploy: { command: "vp run web#deploy", cache: false },
      // The deployed Worker's logs as they happen (Void's `void project logs`: a live tail on
      // Cloudflare). For history, Workers Logs (`pnpm exec cf o11y telemetry query`).
      logs: { command: "vp run web#logs", cache: false },
    },
  },
});
