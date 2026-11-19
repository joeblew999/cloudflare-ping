// The deployed app (void.config.ts names the Worker), and the name the CLI signs in as (auth.ts,
// packages/cli/sign-in.ts).
export const SITE = "cloudflare-ping.gedw99.workers.dev";
export const CLI_CLIENT_ID = "cloudflare-ping-cli";

// The Cloudflare account it runs in (void.config.ts), whose Workers logs `/api/trace` reads.
export const ACCOUNT_ID = "7384af54e33b8a54ff240371ea368440";
