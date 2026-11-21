// A list from someone else's server, kept in Void's KV and re-checked by asking "changed?"
// (`If-None-Match`, with the version tag it last sent: plan 2026-11-20-03). A 304 keeps what's
// kept; a 200 replaces it. What's read back is checked against its schema, so a value of another
// shape (an older version's) is fetched again; the key carries a version too.
import { fail } from "void-commands/server";
import { kv } from "void/kv";
import { logger } from "void/log";
import { z } from "zod";

export type Source<T> = {
  // The KV key, with a version (lists:v1:…), bumped when `T` changes shape.
  key: string;
  url: string;
  // How long before asking "changed?" again; null: only when `force`d.
  recheckSeconds: number | null;
  schema: z.ZodType<T>;
  reduce: (response: Response) => Promise<T>;
};

export type Read<T> = { data: T; changed: boolean };

export async function cachedSource<T>(
  source: Source<T>,
  options: { force?: boolean; now?: number } = {},
): Promise<Read<T>> {
  const now = options.now ?? Date.now();
  const kept = z.object({
    etag: z.string().nullable(),
    checkedAt: z.number(),
    data: source.schema,
  });
  const read = kept.safeParse(await kv.get(source.key));
  const entry = read.success ? read.data : null;
  const fresh =
    entry &&
    !options.force &&
    (source.recheckSeconds === null || now - entry.checkedAt < source.recheckSeconds * 1000);
  if (entry && fresh) {
    return { data: entry.data, changed: false };
  }
  const response = await fetch(source.url, {
    headers: entry?.etag ? { "if-none-match": entry.etag } : {},
  }).catch(() => null);
  if (entry && response?.status === 304) {
    await kv.put(source.key, { ...entry, checkedAt: now });
    return { data: entry.data, changed: false };
  }
  if (!response?.ok) {
    if (entry) {
      // Down for a moment: what's kept still stands.
      logger.warn(`${source.url} didn't answer; using what's kept`, { status: response?.status });
      return { data: entry.data, changed: false };
    }
    fail("refused", `${source.url} couldn't be read (HTTP ${response?.status ?? "no answer"})`);
  }
  const data = await source.reduce(response);
  await kv.put(source.key, { etag: response.headers.get("etag"), checkedAt: now, data });
  return { data, changed: true };
}
