// The public address this request went out to the internet from, as a server outside Cloudflare
// sees it. Globalping's API is behind Fastly, not Cloudflare, so it sees this address too, and
// without a token counts its free tests by it. A site on Cloudflare would see Cloudflare's own
// internal address for a Worker instead, so the echo is api64.ipify.org: not on Cloudflare, and
// on IPv4 and IPv6, as Globalping is (checked 2026-11-20). Null when it can't be asked.
import { logger } from "void/log";

export async function outboundAddress(): Promise<string | null> {
  try {
    const response = await fetch("https://api64.ipify.org");
    return response.ok ? (await response.text()).trim() : null;
  } catch (caught) {
    logger.warn("The outbound address couldn't be asked", {
      error: caught instanceof Error ? caught.message : String(caught),
    });
    return null;
  }
}
