/**
 * /sessions: what this workspace has saved, newest first, so /resume has
 * something to name.
 */

import { listSessions } from "../../harness/agent/state.ts";
import type { Command } from "./command.ts";

export const sessions: Command = {
  name: "sessions",
  description: "List the saved sessions in this workspace, newest first.",
  async run(_args, ctx) {
    const ids = await listSessions(ctx.workspace);
    if (ids.length === 0) return "No saved sessions in this workspace.";
    return `${ids.length} saved:\n${ids.join("\n")}`;
  },
};
