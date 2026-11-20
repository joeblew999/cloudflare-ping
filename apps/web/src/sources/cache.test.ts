// The caching rules (plan 2026-11-20-03, "Testing the refresh rules"): Void's KV as an in-memory
// map (Void's guide/testing.md), `fetch` replaced, the clock passed in.
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { z } from "zod";
import { cachedSource, type Source } from "./cache";

const store = new Map<string, unknown>();
vi.mock("void/kv", () => ({
  kv: {
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: unknown) => {
      store.set(key, JSON.parse(JSON.stringify(value)));
    },
  },
}));
vi.mock("void/log", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const fetched = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
vi.stubGlobal("fetch", fetched);

const answer = (body: unknown, etag = '"v1"') =>
  new Response(JSON.stringify(body), { headers: { etag } });

const source: Source<Array<string>> = {
  key: "test:v1:list",
  url: "https://example.test/list",
  recheckSeconds: 300,
  schema: z.array(z.string()),
  reduce: async (response) => z.array(z.string()).parse(await response.json()),
};

describe("cachedSource", () => {
  beforeEach(() => {
    store.clear();
    fetched.mockReset();
  });

  it("is read once, then kept", async () => {
    fetched.mockResolvedValue(answer(["a"]));
    await cachedSource(source, { now: 0 });
    const again = await cachedSource(source, { now: 1000 });
    expect(again).toEqual({ data: ["a"], changed: false });
    expect(fetched).toHaveBeenCalledOnce();
  });

  it("past its interval, asks 'changed?' with the tag; a 304 keeps it", async () => {
    fetched.mockResolvedValueOnce(answer(["a"], '"v1"'));
    await cachedSource(source, { now: 0 });
    fetched.mockResolvedValueOnce(new Response(null, { status: 304 }));
    const again = await cachedSource(source, { now: 301_000 });
    expect(again).toEqual({ data: ["a"], changed: false });
    expect(fetched.mock.calls[1]?.[1]?.headers).toEqual({ "if-none-match": '"v1"' });
  });

  it("a 200 replaces it, and says so", async () => {
    fetched.mockResolvedValueOnce(answer(["a"], '"v1"'));
    await cachedSource(source, { now: 0 });
    fetched.mockResolvedValueOnce(answer(["a", "b"], '"v2"'));
    expect(await cachedSource(source, { now: 301_000 })).toEqual({
      data: ["a", "b"],
      changed: true,
    });
  });

  it("asks at once when forced (a test saw something new)", async () => {
    // A fresh answer each time: a response's body can be read once.
    fetched.mockImplementation(async () => answer(["a"]));
    await cachedSource(source, { now: 0 });
    await cachedSource(source, { now: 1000, force: true });
    expect(fetched).toHaveBeenCalledTimes(2);
  });

  it("with no interval, never asks again unless forced (the airport places)", async () => {
    fetched.mockResolvedValue(answer(["a"]));
    await cachedSource({ ...source, recheckSeconds: null }, { now: 0 });
    await cachedSource({ ...source, recheckSeconds: null }, { now: 365 * 86_400_000 });
    expect(fetched).toHaveBeenCalledOnce();
  });

  it("an old-shaped value (an older version's) is ignored and read fresh", async () => {
    store.set(source.key, { etag: null, checkedAt: 0, data: [1, 2] });
    fetched.mockResolvedValue(answer(["a"]));
    expect(await cachedSource(source, { now: 1000 })).toEqual({ data: ["a"], changed: true });
  });

  it("a source that's down leaves what's kept; with nothing kept, it fails", async () => {
    fetched.mockResolvedValueOnce(answer(["a"]));
    await cachedSource(source, { now: 0 });
    fetched.mockResolvedValueOnce(new Response("down", { status: 503 }));
    expect(await cachedSource(source, { now: 301_000 })).toEqual({ data: ["a"], changed: false });
    store.clear();
    fetched.mockResolvedValueOnce(new Response("down", { status: 503 }));
    await expect(cachedSource(source, { now: 0 })).rejects.toThrow("couldn't be read");
  });
});
