// Light or dark before the page paints (Void's headDefaults: its guide's own example is a theme
// script), as VitePress decides it (src/appearance.ts). The rest of the head is void.config.ts.
import { defineMiddleware } from "void";
import { APPEARANCE_SCRIPT } from "../src/appearance";

export default defineMiddleware(async (c, next) => {
  c.set("headDefaults", { script: [{ innerHTML: APPEARANCE_SCRIPT }] });
  await next();
});
