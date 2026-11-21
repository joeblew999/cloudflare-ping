// `cloudflare-ping open [<page>] [--browser <app>]`: a page of the app in a browser, signed in as
// this machine is (plan 2026-11-21-02). The CLI asks Void's auth for a one-time token (Better
// Auth's `oneTimeToken`, auth.ts: once, within 3 minutes) and opens `/open?to=<page>#token=…`,
// which hands it to Better Auth and goes on to the page (pages/open.tsx). The token is in the
// fragment, so no server logs it, and the CLI never prints it. It's this machine's session, so
// signing out in the browser signs this machine out too.
import { parseArgs } from "node:util";
import { FetchError } from "void/client";
import { z } from "zod";
import { openInBrowser } from "@cloudflare-ping/shared/browser";
import { open as definition } from "@cloudflare-ping/shared/commands";
import { commonOptions, signedIn, siteOf, stop } from "../api";

const issued = z.object({ token: z.string() });

export async function open(args: Array<string>) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { ...definition.cli.flags, ...commonOptions },
  });
  const site = siteOf(values.site);
  const asked = definition.input.shape.page.safeParse(positionals[0]);
  if (!asked.success) {
    return stop(new Error("Give a page on the app, starting with /: cloudflare-ping open /runs"));
  }
  const page = asked.data ?? "/";
  const { token } = await signedIn(site, async (authorization) => {
    const response = await fetch(`${site}/api/auth/one-time-token/generate`, {
      headers: { authorization },
    });
    if (!response.ok) {
      // Void's own error, so `signedIn` signs this machine in again on a 401, as for any command.
      const failed = new FetchError("The app wouldn't sign a browser in");
      failed.status = response.status;
      throw failed;
    }
    return issued.parse(await response.json());
  });
  const url = `${site}/open?to=${encodeURIComponent(page)}#token=${encodeURIComponent(token)}`;
  const browser = values.browser ?? process.env.BROWSER;
  try {
    await openInBrowser(url, browser);
  } catch {
    return stop(new Error(`Couldn't open ${browser ?? "the browser"}`));
  }
  console.log(
    `Opened ${site}${page} in ${browser ?? "the default browser"}, signed in as this machine is (the link works once, within 3 minutes).`,
  );
}
