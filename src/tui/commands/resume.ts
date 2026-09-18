/**
 * /resume: continue a saved session in place. The transcript is rebuilt from
 * what is on disk, and a session recorded elsewhere refuses to load rather
 * than replaying tool results about files this workspace does not have.
 */

import { loadSession } from "../../harness/agent/state.ts";
import { restore } from "../input/history.ts";
import type { Command } from "./command.ts";

export const resume: Command = {
  name: "resume",
  description: "Continue a saved session: /resume <id>.",
  needsIdle: true,
  async run(args, ctx) {
    const id = args.trim();
    if (!id) return "Which session? /sessions lists them.";

    const session = await loadSession(ctx.workspace, id);
    ctx.setSession(session);
    ctx.replaceTranscript({ ...restore(session.entries), turn: session.turns });
    return `Resumed ${id}, ${session.turns} turns so far.`;
  },
};
