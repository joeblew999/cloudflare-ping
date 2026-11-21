// One question, as each surface takes it (`questionFor`), for the real commands in the list.
import { describe, expect, it } from "vite-plus/test";
import { COMMAND_LIST, questionFor } from "./commands";

const command = (name: string) => {
  const found = COMMAND_LIST.find((each) => each.name === name);
  if (!found) {
    throw new Error(`No command ${name}`);
  }
  return found;
};

describe("questionFor", () => {
  it("puts the bare argument first, and the other options as flags and the query", () => {
    expect(questionFor(command("places"), { q: "Bang Khae", limit: 5 })).toEqual({
      method: "GET",
      path: "/api/places?q=Bang+Khae&limit=5",
      cli: ["places", "Bang Khae", "--limit", "5"],
    });
  });

  it("says true and false as the CLI's own flags", () => {
    expect(questionFor(command("run"), { from: "TH", inline: true, everywhere: false })).toEqual({
      method: "POST",
      path: "/api/runs?from=TH&inline=true&everywhere=false",
      cli: ["run", "--from", "TH", "--inline", "--no-everywhere"],
    });
  });

  it("fills the route's own places from the options", () => {
    expect(questionFor(command("trace"), { ray: "a5cf35412be9a955", minutes: 90 })).toEqual({
      method: "GET",
      path: "/api/trace/a5cf35412be9a955?minutes=90",
      cli: ["trace", "a5cf35412be9a955", "--minutes", "90"],
    });
    expect(questionFor(command("show"), { id: "ad670a1f" }).path).toBe("/api/runs/ad670a1f");
  });

  it("asks nothing more than the command alone, given nothing", () => {
    expect(questionFor(command("runs"), {})).toEqual({
      method: "GET",
      path: "/api/runs",
      cli: ["runs"],
    });
  });

  it("marks exactly the commands that spend tests: a test, a run, a new map", () => {
    expect(COMMAND_LIST.filter((each) => each.spends).map((each) => each.name)).toEqual([
      "test",
      "run",
      "remap",
    ]);
  });
});
