import { defineConfig } from "vite-plus";
import { voidPlugin } from "void";
import { voidReact } from "@void/react/plugin";

export default defineConfig({
  plugins: [voidPlugin(), voidReact({ react: { compiler: true } })],
  run: {
    tasks: {
      // One Globalping test to the deployed probe, and what came back (scripts/probe-test.ts).
      "probe:test": { command: "vpx scripts/probe-test.ts", cache: false },
    },
  },
});
