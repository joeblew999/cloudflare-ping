// The skill in the repo is the one the commands list writes (skill.ts): if a command or its
// words change, `vp run cloudflare-ping#build` writes it again.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";
import { COMMAND_LIST } from "@cloudflare-ping/shared/commands";
import { SKILL_PATH, skillText } from "./skill";

const written = readFileSync(join(dirname(fileURLToPath(import.meta.url)), SKILL_PATH), "utf8");

describe("the skill", () => {
  it("is the one the commands list writes", () => {
    expect(written).toBe(skillText());
  });

  it("names every command and every tool", () => {
    for (const command of COMMAND_LIST) {
      expect(written).toContain(`cloudflare-ping ${command.use}`);
      if (command.tool) {
        expect(written).toContain(`\`${command.tool}\``);
      }
    }
  });
});
