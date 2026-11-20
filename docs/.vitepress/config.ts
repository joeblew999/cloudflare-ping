// The docs (VitePress), served by the app at /docs/: built into public/docs, which the app's own
// build then ships with everything else in public/ (void.config.ts: `inference.build`). Void's
// guide says to keep voidPlugin() in the root vite.config.ts only, never here.
import { defineConfig } from "vitepress";
import { SITE } from "@cloudflare-ping/shared/site";

const APP = `https://${SITE}`;

export default defineConfig({
  title: "cloudflare-ping",
  description: "Probes from around the world, run from Cloudflare's data centres",
  base: "/docs/",
  outDir: "../public/docs",
  cleanUrls: true,
  lastUpdated: true,
  // The app's icon (public/favicon.svg): the docs are served by the app, on its site.
  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }]],
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide" },
      { text: "Commands", link: "/cli" },
      { text: "How it works", link: "/how-it-works" },
      {
        text: "The app",
        items: [
          { text: "Probe", link: `${APP}/`, target: "_self" },
          { text: "Runs", link: `${APP}/runs`, target: "_self" },
        ],
      },
    ],
    sidebar: [
      {
        text: "Use it",
        items: [
          { text: "What you can do", link: "/guide" },
          { text: "Commands", link: "/cli" },
          { text: "From an AI agent", link: "/agents" },
        ],
      },
      {
        text: "How it's built",
        items: [{ text: "How it works", link: "/how-it-works" }],
      },
    ],
    search: { provider: "local" },
    outline: [2, 3],
  },
});
