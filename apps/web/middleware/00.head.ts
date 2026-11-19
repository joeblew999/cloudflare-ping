// Light or dark before the page paints (Void's headDefaults: its guide's own example is a theme
// script), as VitePress decides it (src/appearance.ts).
import { defineMiddleware } from "void";
import { APPEARANCE_SCRIPT } from "../src/appearance";

export default defineMiddleware(async (c, next) => {
  c.set("headDefaults", {
    meta: [{ name: "viewport", content: "width=device-width, initial-scale=1" }],
    // The app's icon (public/favicon.svg), the docs' too.
    link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    script: [{ innerHTML: APPEARANCE_SCRIPT }],
  });
  await next();
});
