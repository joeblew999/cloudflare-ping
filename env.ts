// The app's settings on Cloudflare (`void secret put NAME=value`); locally, in `.env`.
import { defineEnv, string } from "void/env";

export default defineEnv({
  // Who may make an account (auth.ts): email addresses, comma-separated. Unset, nobody can.
  ALLOWED_EMAILS: string().optional(),
  // A Globalping account's token, for its own hourly limit (src/globalping.ts). Unset, the app's
  // tests count against the free limit of the address its requests leave from (plan step 6).
  GLOBALPING_TOKEN: string().optional(),
});
