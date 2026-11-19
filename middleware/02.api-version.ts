// A CLI built for another version of the API (src/version.ts) is told to update, before any
// route runs. Calls without the header (the pages, curl) are let through.
import { defineMiddleware } from "void";
import { API_VERSION, API_VERSION_HEADER } from "../src/version";

export default defineMiddleware(async (c, next) => {
  const built = c.req.header(API_VERSION_HEADER);
  if (built !== undefined && built !== String(API_VERSION) && c.req.path.startsWith("/api/")) {
    return c.json(
      {
        message: `This cloudflare-ping is for version ${built} of the app's API, and the app is on ${API_VERSION}: update it (npm install --global cloudflare-ping), or in the repo, pull.`,
      },
      426,
    );
  }
  await next();
});
