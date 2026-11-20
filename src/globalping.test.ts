// Reading the data centre a probe's answer names (plan step 2: an answer cut off at Globalping's
// 10,000 bytes still names it).
import { describe, expect, it } from "vite-plus/test";
import { coloOf } from "./globalping";

describe("coloOf", () => {
  it("reads a whole answer", () => {
    expect(coloOf(JSON.stringify({ colo: "BKK", padding: "x" }))).toBe("BKK");
  });

  it("reads an answer cut off before its end", () => {
    expect(coloOf('{"colo":"SIN","padding":"xxxxxxxx')).toBe("SIN");
  });

  it("answers nothing for an answer that names none", () => {
    expect(coloOf("error code: 1042")).toBe("");
  });
});
