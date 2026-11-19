// The CLI as the `cloudflare-ping` package: `vp pack` builds main.ts into one file, dist/main.mjs,
// with every dependency inside it (the shared package, void/client, zod), so installing it
// installs nothing else.
import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { main: "main.ts" },
    outDir: "dist",
    platform: "node",
    target: "node22",
    format: "esm",
    clean: true,
    deps: { alwaysBundle: [/.*/] },
  },
});
