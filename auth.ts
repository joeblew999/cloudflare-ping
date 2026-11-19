// Who may use what spends Globalping tests (plan step 6): Void's auth (Better Auth), with two of
// Better Auth's own plugins. Device login: the CLI signs in once per machine, approved in the
// browser (cli/sign-in.ts, pages/device.tsx). Bearer: the CLI's token is read from its
// Authorization header. Only the addresses in ALLOWED_EMAILS (env.ts) can make an account.
import { bearer } from "better-auth/plugins/bearer";
import { deviceAuthorization } from "better-auth/plugins/device-authorization";
import { defineAuth } from "void/auth";
import { CLI_CLIENT_ID } from "./src/site";

export default defineAuth(({ defaults, env }) => {
  const list = typeof env.ALLOWED_EMAILS === "string" ? env.ALLOWED_EMAILS : "";
  const allowed = new Set(
    list
      .split(",")
      .map((each) => each.trim().toLowerCase())
      .filter((each) => each !== ""),
  );
  return {
    ...defaults,
    plugins: [
      ...(defaults.plugins ?? []),
      bearer(),
      deviceAuthorization({
        verificationUri: "/device",
        validateClient: (clientId) => clientId === CLI_CLIENT_ID,
      }),
    ],
    databaseHooks: {
      user: {
        create: {
          before: (user) =>
            Promise.resolve(allowed.has(user.email.toLowerCase()) ? { data: user } : false),
        },
      },
    },
  };
});
