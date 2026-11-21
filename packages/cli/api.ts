// What every command shares: which copy of the app it talks to (`--site`, the deployed one unless
// given), and calling the app's API, signed in when it must be (packages/cli/sign-in.ts), signing in again
// once if the app no longer takes this machine's token. The commands call the API with Void's
// typed fetch (`void/client`), the same calls the pages make, and say the API version they were
// built for (packages/shared/src/version.ts). A failure prints the same words a page shows.
import { FetchError } from "void/client";
import { exitCodeOf } from "void-commands/cli";
import { SITE } from "@cloudflare-ping/shared/site";
import { failure } from "@cloudflare-ping/shared/failure";
import { API_VERSION, API_VERSION_HEADER } from "@cloudflare-ping/shared/version";
import { forget, fromEnv, token } from "./sign-in";

export const siteOf = (given: string | undefined) =>
  (given ?? `https://${SITE}`).replace(/\/+$/, "");

// The options every command takes (COMMON_OPTIONS, packages/shared/src/commands.ts, says so):
// `--site`, and `--json` for the API's answer as it is. Spread into each command's own options.
export const commonOptions = {
  json: { type: "boolean", default: false },
  site: { type: "string" },
} as const;

// With `--json`, a command prints the API's answer as it came, and nothing else: true when it
// did, so the command stops there. Otherwise the command says it for a person.
export function printedJson(wanted: boolean, found: unknown): boolean {
  if (wanted) {
    console.log(JSON.stringify(found, null, 2));
  }
  return wanted;
}

// The headers every call sends; with `authorization` when signed in.
export const headers = (authorization?: string): Record<string, string> => ({
  [API_VERSION_HEADER]: String(API_VERSION),
  ...(authorization ? { authorization } : {}),
});

// When a call fails: the same words a page shows (packages/shared/src/failure.ts), and the exit code
// for the kind of failure (void-commands' FAILURES: 3 signed out, 5 not found, 6 a limit reached…),
// so a script can tell them apart.
export function stop(error: unknown): never {
  console.error(failure(error));
  process.exit(exitCodeOf(error instanceof FetchError ? (error.status ?? null) : null));
}

// An API call anyone may make (reading runs).
export async function asked<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    return stop(error);
  }
}

// An API call that needs this machine signed in.
export async function signedIn<T>(
  site: string,
  call: (authorization: string) => Promise<T>,
): Promise<T> {
  try {
    return await call(`Bearer ${await token(site)}`);
  } catch (error) {
    if (!(error instanceof FetchError && error.status === 401) || fromEnv()) {
      return stop(error);
    }
    await forget(site);
    return asked(async () => call(`Bearer ${await token(site)}`));
  }
}

// A row of a run, as the CLI prints it (run, show).
export type Row = {
  colo: string | null;
  targetColo: string | null;
  attempt: number;
  isr: string | null;
  ms: number;
  status: number;
  ray: string;
};

export function printRow(row: Row) {
  const same = row.targetColo === row.colo ? "same" : "DIFFERENT";
  console.log(
    `  ${row.colo ?? "?"} → ${row.targetColo ?? "?"} (${same})  #${row.attempt}  ${row.isr ?? "-"}  ${row.ms} ms  HTTP ${row.status}  ray ${row.ray}`,
  );
}
