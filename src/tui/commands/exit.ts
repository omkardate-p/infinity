/**
 * /exit: put the terminal back and end the run, the same way the second
 * Ctrl-C does.
 */

import type { Command } from "./command.ts";

export const exit: Command = {
  name: "exit",
  description: "Leave infinity.",
  run(_args, ctx) {
    ctx.onExit();
    return undefined;
  },
};
