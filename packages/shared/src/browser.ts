// A page opened in a browser, for the CLI (`cloudflare-ping open`) and the repo's scripts (an MCP
// sign-in's approval): the one asked for, by name on a Mac (`open -a "Google Chrome"`) or as a
// command elsewhere, then `BROWSER`, then the system's default. On this Mac the default is Safari,
// while the agent drives Chrome. Node only: the Worker never imports it.
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export async function openInBrowser(url: string, browser = process.env.BROWSER): Promise<void> {
  const [command, args]: [string, Array<string>] =
    process.platform === "darwin"
      ? ["open", browser ? ["-a", browser, url] : [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : [browser ?? "xdg-open", [url]];
  await promisify(execFile)(command, args);
}
