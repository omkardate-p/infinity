/**
 * /help: the commands and what each one does. It is handed the list rather
 * than importing the registry, which would make the two import each other.
 */

import type { Command } from "./command.ts";

export const help: Command = {
  name: "help",
  description: "List the commands and what each one does.",
  run(_args, ctx) {
    const width = ctx.commands.reduce(
      (most, command) => Math.max(most, command.name.length),
      0,
    );
    return ctx.commands
      .map(
        (command) => `/${command.name.padEnd(width)}  ${command.description}`,
      )
      .join("\n");
  },
};
