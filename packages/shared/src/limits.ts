// Globalping's limit as `GET /api/limits` answers it, in the words the Runs page and the CLI's
// `limits` both show.
export type Limits = {
  colo: string | null;
  // The address the Worker went out from, which Globalping counts without a token.
  address: string | null;
  globalping: {
    by: string;
    limit: number;
    remaining: number;
    resetSeconds: number;
    credits: number | null;
    token: boolean;
  };
};

export function limitsLine({ colo, address, globalping }: Limits) {
  const whose = globalping.token
    ? "the app's Globalping account"
    : `the Worker's address${address ? ` ${address}` : ""} in ${colo ?? "?"}, shared with other Cloudflare customers (no Globalping token set)`;
  const reset =
    globalping.resetSeconds > 0 ? `, more in ${Math.ceil(globalping.resetSeconds / 60)} min` : "";
  const credits = globalping.credits === null ? "" : `, and ${globalping.credits} credits`;
  return `Globalping: ${globalping.remaining} of ${globalping.limit} tests left this hour for ${whose}${reset}${credits}.`;
}
