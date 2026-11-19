// The app's own Vite config: Void and its React pages, and its build. Lint, format and the repo's
// tasks are in the root vite.config.ts (Vite+'s monorepo guide).
import { voidReact } from "@void/react/plugin";
import { voidPlugin } from "void";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [voidPlugin(), voidReact({ react: { compiler: true } })],
  run: {
    tasks: {
      // The app, after the workspace packages it depends on (package.json): the docs, which build
      // into public/docs for it to ship at /docs/. `void deploy` runs this (void.config.ts).
      build: {
        command: "vp build",
        dependsOn: [{ task: "build", from: ["dependencies", "devDependencies"] }],
        cache: false,
      },
    },
  },
});
