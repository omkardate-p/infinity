/**
 * /clear: an empty screen and a new session. The session already on disk is
 * left where it is; only this run stops carrying it.
 */

import { empty } from "../state/view-model.ts";
import type { Command } from "./command.ts";

export const clear: Command = {
  name: "clear",
  description: "Clear the screen and start a new session.",
  needsIdle: true,
  run(_args, ctx) {
    ctx.setSession(undefined);
    ctx.replaceTranscript(empty());
    return undefined;
  },
};
