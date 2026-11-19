// The version of the app's API that the CLI is built for. The CLI sends it with every call
// (`x-cloudflare-ping-api`, packages/cli/api.ts), and the app refuses a CLI built for another one with
// "update it" (middleware/02.api-version.ts), rather than failing on a changed route. Raise it
// whenever an API route changes in a way an older CLI can't use. The pages are always built with
// the app, so they don't send it.
export const API_VERSION = 1;
export const API_VERSION_HEADER = "x-cloudflare-ping-api";
