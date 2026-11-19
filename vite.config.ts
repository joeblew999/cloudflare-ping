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
  // The CLI as the `cloudflare-ping` package (cli/package.json): one file, every dependency inside
  // it, so installing it installs nothing else. `vp run cli:pack`.
  pack: {
    entry: { main: "cli/main.ts" },
    outDir: "cli/dist",
    platform: "node",
    target: "node22",
    format: "esm",
    clean: true,
    deps: { alwaysBundle: [/.*/] },
  },
  run: {
    // The CLI from source: one task per thing the app does (cli/main.ts), each calling the app's
    // API, as its page does (the README's table); the same commands as the package's.
    tasks: {
      // Any command: `vp run cli -- <command> [options]`.
      cli: { command: "vpx cli/main.ts", cache: false },
      // One Globalping test (`POST /api/probe`): the home page's "Run a probe".
      "probe:test": { command: "vpx cli/main.ts test", cache: false },
      // A request's Cloudflare log, by ray ID (`GET /api/trace/<ray>`): /trace/<ray>.
      "probe:trace": { command: "vpx cli/main.ts trace", cache: false },
      // Start a run and follow its fetches (`POST /api/runs`): the Runs page's "Start a run".
      "ping:run": { command: "vpx cli/main.ts run", cache: false },
      // The newest runs (`GET /api/runs`): the Runs page's list.
      "ping:runs": { command: "vpx cli/main.ts runs", cache: false },
      // One run and its fetches (`GET /api/runs/<id>`): /runs/<id>.
      "ping:show": { command: "vpx cli/main.ts show", cache: false },
      // Sign this machine in, out, and who it's signed in as: /login, "Sign out", the top bar.
      "ping:sign-in": { command: "vpx cli/main.ts sign-in", cache: false },
      "ping:sign-out": { command: "vpx cli/main.ts sign-out", cache: false },
      "ping:whoami": { command: "vpx cli/main.ts whoami", cache: false },
      // Build the package (cli/dist/main.mjs), and try the built file.
      "cli:pack": { command: "vp pack", cache: false },
      "cli:try": { command: "node cli/dist/main.mjs", cache: false },
      // The docs (VitePress, docs/): write them with docs:dev (its own server, /docs/); docs:build
      // puts them in public/docs, where `vp dev` and the deployed app serve them at /docs/.
      // `void deploy` builds them itself (void.config.ts).
      "docs:dev": { command: "pnpm --dir docs dev", cache: false },
      "docs:build": { command: "pnpm --dir docs build", cache: false },
      "docs:preview": { command: "pnpm --dir docs preview", cache: false },
    },
  },
});
