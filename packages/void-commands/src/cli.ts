// void-commands/cli: what a CLI needs from the definitions: each command's flags for
// node:util's parseArgs, its usage line (help, docs), and the exit code for a failure.
import { z } from "zod";
import { FAILURES, kindOfStatus, type CommandDefinition, type Flag } from "void-commands";

// A command's flags as parseArgs takes them (without their words), for `parseArgs({ options })`.
export function parseOptionsOf<Flags extends Record<string, Flag>>(flags: Flags) {
  return Object.fromEntries(
    Object.entries(flags).map(([name, flag]) => [
      name,
      flag.type === "string"
        ? {
            type: "string" as const,
            ...(flag.default === undefined ? {} : { default: flag.default }),
          }
        : {
            type: "boolean" as const,
            ...(flag.default === undefined ? {} : { default: flag.default }),
          },
    ]),
  );
}

// `show <id>`, `run [--target <url>] [--from TH] [--inline]`: from the definition alone.
export function usageOf(definition: CommandDefinition): string {
  const cli = definition.cli;
  if (!cli) {
    return definition.name;
  }
  const words = [definition.name];
  if (cli.argument) {
    const field = definition.input.shape[cli.argument];
    const optional = field ? z.safeParse(field, undefined).success : true;
    words.push(optional ? `[<${cli.argument}>]` : `<${cli.argument}>`);
  }
  for (const [name, flag] of Object.entries(cli.flags)) {
    words.push(flag.type === "boolean" ? `[--${name}]` : `[--${name} ${flag.hint ?? `<${name}>`}]`);
  }
  return words.join(" ");
}

// Each flag and what it does, for a command's help.
export function flagLines(definition: CommandDefinition): Array<string> {
  return Object.entries(definition.cli?.flags ?? {}).map(([name, flag]) => {
    const given =
      flag.default === undefined || flag.default === false
        ? ""
        : ` (${String(flag.default)} unless given)`;
    return `--${name}: ${flag.help}${given}`;
  });
}

// The exit code for an API call that failed with this status: the failure kind's, or 1.
export function exitCodeOf(status: number | null): number {
  const kind = status === null ? null : kindOfStatus(status);
  return kind ? FAILURES[kind].exit : 1;
}
