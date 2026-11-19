import { defineConfig } from "vite-plus";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";
import { voidRules } from "./lint/void-rules";

export default defineConfig({
  plugins: [voidPlugin(), voidReact({ react: { compiler: true } })],
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
      // nothing" too: noUncheckedIndexedAccess in tsconfig.json).
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
    // Written by tools, not by hand: drizzle (migrations), Void (AGENTS.md).
    ignorePatterns: ["**/db/migrations/**", "**/AGENTS.md"],
  },
  run: {
    // The CLI: one task per thing the app does, each calling the app's API, as its page does (the
    // README's table). Those that spend Globalping tests sign this machine in first if needed.
    tasks: {
      // One Globalping test (`POST /api/probe`): the home page's "Run a probe".
      "probe:test": { command: "vpx scripts/probe-test.ts", cache: false },
      // A request's Cloudflare log, by ray ID (`GET /api/trace/<ray>`): /trace/<ray>.
      "probe:trace": { command: "vpx scripts/probe-trace.ts", cache: false },
      // Start a run and follow its fetches (`POST /api/runs`): the Runs page's "Start a run".
      "ping:run": { command: "vpx scripts/ping-run.ts", cache: false },
      // The newest runs (`GET /api/runs`): the Runs page's list.
      "ping:runs": { command: "vpx scripts/ping-runs.ts", cache: false },
      // One run and its fetches (`GET /api/runs/<id>`): /runs/<id>.
      "ping:show": { command: "vpx scripts/ping-show.ts", cache: false },
    },
  },
});
