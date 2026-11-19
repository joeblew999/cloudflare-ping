// The docs (VitePress), served by the app at /docs/: built into public/docs, which the app's own
// build then ships with everything else in public/ (void.config.ts: `inference.build`). Void's
// guide says to keep voidPlugin() in the root vite.config.ts only, never here.
import { defineConfig } from "vitepress";
import { SITE } from "../../src/site";

const APP = `https://${SITE}`;
const REPO = "https://github.com/joeblew999/cloudflare-ping";

export default defineConfig({
  title: "cloudflare-ping",
  description: "Our own Globalping, run from Cloudflare's data centres",
  base: "/docs/",
  outDir: "../public/docs",
  cleanUrls: true,
  lastUpdated: true,
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
        ],
      },
      {
        text: "How it's built",
        items: [
          { text: "How it works", link: "/how-it-works" },
          { text: "The plan", link: "/plan" },
        ],
      },
    ],
    search: { provider: "local" },
    outline: [2, 3],
    socialLinks: [{ icon: "github", link: REPO }],
    editLink: { pattern: `${REPO}/edit/main/docs/:path`, text: "Edit this page on GitHub" },
  },
});
