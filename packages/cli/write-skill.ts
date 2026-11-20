// Writes the package's skill (skill.ts) to skills/cloudflare-ping/SKILL.md: the package's build
// runs it before `vp pack`.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SKILL_PATH, skillText } from "./skill";

const file = join(dirname(fileURLToPath(import.meta.url)), SKILL_PATH);
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, skillText());
console.log(`Wrote ${SKILL_PATH}`);
