// The web pages' "Sign in", "Sign out" and who's signed in (pages/layout.tsx), as commands:
// `cloudflare-ping sign-in` (device login, now, even if this machine has a token),
// `cloudflare-ping sign-out` (ends the session at the app, and forgets the token), and
// `cloudflare-ping whoami`. Through Void's auth (Better Auth's `/api/auth` routes).
import { parseArgs } from "node:util";
import { z } from "zod";
import { siteOf } from "../api";
import { forget, fromEnv, token, tokenIfAny } from "../sign-in";

const session = z.object({ user: z.object({ email: z.string() }) }).nullable();

function siteFrom(args: Array<string>) {
  const { values } = parseArgs({ args, options: { site: { type: "string" } } });
  return siteOf(values.site);
}

// Who the app says this token belongs to, or null if it no longer takes it.
async function emailOf(site: string, bearer: string): Promise<string | null> {
  const response = await fetch(`${site}/api/auth/get-session`, {
    headers: { authorization: `Bearer ${bearer}` },
  });
  if (!response.ok) {
    return null;
  }
  const found = session.safeParse(await response.json());
  return found.success && found.data ? found.data.user.email : null;
}

export async function whoami(args: Array<string>) {
  const site = siteFrom(args);
  const have = await tokenIfAny(site);
  const email = have ? await emailOf(site, have) : null;
  console.log(
    email
      ? `Signed in to ${site} as ${email}${fromEnv() ? " (CLOUDFLARE_PING_TOKEN)" : ""}.`
      : `Not signed in to ${site}${have ? " (this machine's token has expired)" : ""}: cloudflare-ping sign-in`,
  );
}

export async function signIn(args: Array<string>) {
  const site = siteFrom(args);
  if (fromEnv()) {
    console.log("CLOUDFLARE_PING_TOKEN is set, so commands use it; unset it to sign in here.");
    return;
  }
  await forget(site);
  const email = await emailOf(site, await token(site));
  console.log(email ? `Signed in to ${site} as ${email}.` : "Signed in.");
}

export async function signOut(args: Array<string>) {
  const site = siteFrom(args);
  const have = await tokenIfAny(site);
  if (have && !fromEnv()) {
    await fetch(`${site}/api/auth/sign-out`, {
      method: "POST",
      headers: { authorization: `Bearer ${have}`, "content-type": "application/json" },
      body: "{}",
    }).catch(() => undefined);
    await forget(site);
  }
  console.log(
    fromEnv()
      ? "CLOUDFLARE_PING_TOKEN is set: unset it to sign out."
      : `Signed out of ${site} on this machine.`,
  );
}
