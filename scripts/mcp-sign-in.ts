// Signing the repo's scripts in to /mcp as any MCP client does (plan 2026-11-20-01; shared by
// `vp run mcp:check` and `vp run mcp:host`, plan 2026-11-21-02): the official SDK's client finds
// where to sign in, registers itself, waits for your approval in the browser (the app's /login if
// that browser isn't signed in, then /consent), then keeps a refresh token. Once per machine and
// site: what it's given is kept in ~/.config/cloudflare-ping/mcp-check.json, readable by you only,
// and never printed. The approval opens in `BROWSER` if set (`BROWSER="Google Chrome"`).
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
  Client,
  StreamableHTTPClientTransport,
  UnauthorizedError,
  auth,
  type OAuthClientMetadata,
  type OAuthClientProvider,
  type OAuthDiscoveryState,
  type StoredOAuthClientInformation,
  type StoredOAuthTokens,
} from "@modelcontextprotocol/client";
import { z } from "zod";
import { openInBrowser } from "@cloudflare-ping/shared/browser";

// What's kept between runs, per site: the registration and the tokens, with the SDK's own fields
// (StoredOAuthClientInformation, StoredOAuthTokens).
const FILE = join(homedir(), ".config", "cloudflare-ping", "mcp-check.json");
const stored = z.object({
  client: z
    .object({
      client_id: z.string(),
      client_secret: z.string().optional(),
      client_id_issued_at: z.number().optional(),
      client_secret_expires_at: z.number().optional(),
      issuer: z.string().optional(),
    })
    .optional(),
  tokens: z
    .object({
      access_token: z.string(),
      token_type: z.string(),
      id_token: z.string().optional(),
      expires_in: z.number().optional(),
      scope: z.string().optional(),
      refresh_token: z.string().optional(),
      issuer: z.string().optional(),
    })
    .optional(),
});
type Stored = z.infer<typeof stored>;

async function readStored(): Promise<Record<string, Stored>> {
  try {
    return z.record(z.string(), stored).parse(JSON.parse(await readFile(FILE, "utf8")));
  } catch {
    // None yet, or unreadable: sign in again.
    return {};
  }
}

// Where the browser comes back to, on this machine, with the approval's code.
const CALLBACK = "http://127.0.0.1:8976/callback";
const metadata: OAuthClientMetadata = {
  client_name: "cloudflare-ping mcp:check",
  redirect_uris: [CALLBACK],
  grant_types: ["authorization_code", "refresh_token"],
  response_types: ["code"],
  token_endpoint_auth_method: "none",
  application_type: "native",
  // offline_access: a refresh token, so later runs need no approval. Not `tests`: the scripts
  // never call a tool that spends them.
  scope: "openid profile email offline_access",
};

export class ScriptProvider implements OAuthClientProvider {
  authorizationUrl: URL | null = null;
  readonly #site: string;
  readonly #all: Record<string, Stored>;
  readonly #state = randomBytes(16).toString("base64url");
  #verifier = "";
  #discovery: OAuthDiscoveryState | undefined;

  constructor(site: string, all: Record<string, Stored>) {
    this.#site = site;
    this.#all = all;
  }
  get redirectUrl() {
    return CALLBACK;
  }
  get clientMetadata() {
    return metadata;
  }
  state() {
    return this.#state;
  }
  clientInformation() {
    return this.#all[this.#site]?.client;
  }
  async saveClientInformation(client: StoredOAuthClientInformation) {
    await this.#save({ ...this.#all[this.#site], client });
  }
  tokens() {
    return this.#all[this.#site]?.tokens;
  }
  async saveTokens(tokens: StoredOAuthTokens) {
    await this.#save({ ...this.#all[this.#site], tokens });
  }
  redirectToAuthorization(url: URL) {
    this.authorizationUrl = url;
  }
  saveCodeVerifier(verifier: string) {
    this.#verifier = verifier;
  }
  codeVerifier() {
    return this.#verifier;
  }
  // Which authorization server the sign-in started with, so the SDK can check the approval came
  // back from the same one (SEP-2352). Only for this run, as the code verifier is.
  saveDiscoveryState(state: OAuthDiscoveryState) {
    this.#discovery = state;
  }
  discoveryState() {
    return this.#discovery;
  }
  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery") {
    if (scope === "all" || scope === "discovery") {
      this.#discovery = undefined;
    }
    const now = this.#all[this.#site] ?? {};
    await this.#save({
      client: scope === "all" || scope === "client" ? undefined : now.client,
      tokens: scope === "all" || scope === "tokens" ? undefined : now.tokens,
    });
  }
  async #save(next: Stored) {
    this.#all[this.#site] = next;
    await mkdir(dirname(FILE), { recursive: true });
    await writeFile(FILE, `${JSON.stringify(this.#all, null, 2)}\n`, { mode: 0o600 });
  }
}

// Your approval, in the browser. The browser comes back to CALLBACK with the code.
function approve(url: URL, state: string): Promise<URLSearchParams> {
  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const at = new URL(request.url ?? "/", CALLBACK);
      if (at.pathname !== "/callback") {
        response.writeHead(404).end();
        return;
      }
      const ok = at.searchParams.get("state") === state && at.searchParams.has("code");
      response.writeHead(ok ? 200 : 400, { "content-type": "text/plain; charset=utf-8" });
      response.end(
        ok ? "Approved. You can close this tab." : "Not approved. The terminal says why.",
      );
      clearTimeout(timer);
      server.close();
      if (ok) {
        resolve(at.searchParams);
      } else {
        reject(new Error(`Not approved (${at.searchParams.get("error") ?? "no code came back"})`));
      }
    });
    // Declared after the server, and only read by it once a request comes.
    const timer = setTimeout(() => {
      server.close();
      reject(new Error("No approval within 5 minutes"));
    }, 300_000);
    server.on("error", reject);
    server.listen(Number(new URL(CALLBACK).port), "127.0.0.1", () => {
      console.log(`Approve this in your browser (sign in if asked, then Allow):\n  ${url.href}`);
      // If the browser can't be opened, the link above still works.
      openInBrowser(url.href).catch(() => undefined);
    });
  });
}

// What's kept for `site`, with nothing connected: enough to send its token, and to refresh it.
export async function storedProvider(site: string) {
  return new ScriptProvider(site, await readStored());
}

// Connected and signed in to `site`'s /mcp: with the kept tokens (refreshed by the SDK when they've
// run out), or after your approval.
export async function signedInClient(site: string, name: string) {
  const mcpUrl = new URL("/mcp", site);
  const provider = await storedProvider(site);
  const client = new Client({ name, version: "1" });
  const transport = new StreamableHTTPClientTransport(mcpUrl, { authProvider: provider });
  try {
    await client.connect(transport);
    return { client, provider, mcpUrl };
  } catch (caught) {
    if (!(caught instanceof UnauthorizedError) || !provider.authorizationUrl) {
      throw caught;
    }
  }
  await transport.finishAuth(await approve(provider.authorizationUrl, provider.state()));
  const signedIn = new Client({ name, version: "1" });
  await signedIn.connect(new StreamableHTTPClientTransport(mcpUrl, { authProvider: provider }));
  return { client: signedIn, provider, mcpUrl };
}

// The access token to send, refreshed first when `stale` (the server answered 401 to it).
export async function accessToken(provider: ScriptProvider, mcpUrl: URL, stale = false) {
  if (stale) {
    await auth(provider, { serverUrl: mcpUrl });
  }
  return provider.tokens()?.access_token ?? "";
}
