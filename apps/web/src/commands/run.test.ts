// Starting a run: a target not on the allowed list is refused before a Globalping test is spent,
// and an allowed one is started with the app's token and held with `waitUntil` (src/commands/run.ts).
// Void's env and the runs module are mocked (Void's guide/testing.md: tests run in Node).
import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_TARGET } from "@cloudflare-ping/shared/targets";
import { run } from "./run";
import { startRun } from "../runs";

vi.mock("void/env", () => ({ env: { GLOBALPING_TOKEN: "test-token" } }));
vi.mock("../runs", () => ({
  startRun: vi.fn(async () => ({ id: "a-run", expected: 2, test: { results: [] } })),
}));

const body = { target: DEFAULT_TARGET, from: "TH", probes: 2, repeat: 1, background: true };
const context = { waitUntil: vi.fn(), colo: "BKK" };

describe("run", () => {
  beforeEach(() => {
    vi.mocked(startRun).mockClear();
    context.waitUntil.mockClear();
  });

  it("refuses a target that isn't allowed, without starting anything", () => {
    expect(() => run({ ...body, target: "https://example.com/" }, context)).toThrow(HTTPException);
    expect(startRun).not.toHaveBeenCalled();
  });

  it("starts an allowed target with the app's token, held past the answer", async () => {
    await expect(run(body, context)).resolves.toMatchObject({ id: "a-run" });
    expect(startRun).toHaveBeenCalledWith({ ...body, token: "test-token" });
    expect(context.waitUntil).toHaveBeenCalledOnce();
  });
});
