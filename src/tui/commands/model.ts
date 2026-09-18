/**
 * /model: run the rest of the session against a different model. The name is
 * resolved by the caller, which owns the provider; nothing here knows one
 * exists.
 */

import type { Command } from "./command.ts";

export const model: Command = {
  name: "model",
  description: "Switch the model for the rest of the session: /model <name>.",
  needsIdle: true,
  run(args, ctx) {
    const name = args.trim();
    if (!name) return `Running ${ctx.model}. Switch with /model <name>.`;
    ctx.setModel(name);
    return `Model is now ${name}.`;
  },
};
