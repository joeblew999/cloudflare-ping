// The CLI's sign-in (plan step 6): Better Auth's device login. The command shows a link and a
// code, the user approves it in the browser (pages/device.tsx, signed in), and the command keeps
// the token it gets, per site, in ~/.config/cloudflare-ping/tokens.json. In CI, where no one is
// there to approve, CLOUDFLARE_PING_TOKEN is used instead. `cloudflare-ping sign-in` and
// `sign-out` (cli/commands/account.ts) do it on purpose.
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { CLI_CLIENT_ID } from "../src/site";

const FILE = join(homedir(), ".config", "cloudflare-ping", "tokens.json");

const tokens = z.record(z.string(), z.string());
const started = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri_complete: z.string(),
  expires_in: z.number(),
  interval: z.number(),
});
const granted = z.object({ access_token: z.string() });
const refused = z.object({ error: z.string() });

async function saved(): Promise<Record<string, string>> {
  try {
    const text = await readFile(FILE, "utf8");
    const parsed = tokens.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

async function save(all: Record<string, string>) {
  await mkdir(dirname(FILE), { recursive: true, mode: 0o700 });
  await writeFile(FILE, `${JSON.stringify(all, null, 2)}\n`, { mode: 0o600 });
}

export const fromEnv = (): string | undefined => process.env.CLOUDFLARE_PING_TOKEN || undefined;

// This machine's token for the site if it has one, without signing in.
export async function tokenIfAny(site: string): Promise<string | undefined> {
  return fromEnv() ?? (await saved())[site];
}

// This machine's token for the site, signing in first if it has none.
export async function token(site: string): Promise<string> {
  const given = fromEnv();
  if (given) {
    return given;
  }
  const all = await saved();
  const have = all[site];
  if (have) {
    return have;
  }
  const fresh = await deviceLogin(site);
  await save({ ...all, [site]: fresh });
  return fresh;
}

// Drops the site's token, when the app no longer takes it.
export async function forget(site: string) {
  const { [site]: _dropped, ...rest } = await saved();
  await save(rest);
}

const post = (url: string, body: object) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

async function deviceLogin(site: string): Promise<string> {
  const response = await post(`${site}/api/auth/device/code`, { client_id: CLI_CLIENT_ID });
  const body: unknown = await response.json();
  const begun = started.safeParse(body);
  if (!response.ok || !begun.success) {
    throw new Error(`Sign-in didn't start (${response.status}): ${JSON.stringify(body)}`);
  }
  const { device_code, user_code, verification_uri_complete } = begun.data;
  console.log(`Sign in: open ${verification_uri_complete}\nand approve the code ${user_code}.\n`);
  // Someone at a terminal on a Mac: open the page for them.
  if (process.platform === "darwin" && process.stdout.isTTY) {
    execFile("open", [verification_uri_complete], () => undefined);
  }

  let interval = begun.data.interval;
  const until = Date.now() + begun.data.expires_in * 1000;
  while (Date.now() < until) {
    await new Promise((wait) => setTimeout(wait, interval * 1000));
    const polled = await post(`${site}/api/auth/device/token`, {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code,
      client_id: CLI_CLIENT_ID,
    });
    const answer: unknown = await polled.json();
    const ok = granted.safeParse(answer);
    if (polled.ok && ok.success) {
      console.log("Signed in.\n");
      return ok.data.access_token;
    }
    const no = refused.safeParse(answer);
    const error = no.success ? no.data.error : `HTTP ${polled.status}`;
    if (error === "slow_down") {
      interval += 5;
    } else if (error !== "authorization_pending") {
      throw new Error(`Sign-in failed: ${error}`);
    }
  }
  throw new Error("Sign-in expired: the code wasn't approved in time.");
}
