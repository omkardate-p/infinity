/**
 * What a command is, and the only things one may touch. A command belongs to
 * the interface: it changes what the terminal shows or which session is open,
 * and it never reaches the agent loop, a tool or a provider. Everything it can
 * do arrives on the context, so a command stays testable without a terminal.
 */

import type { SessionState } from "../../harness/agent/state.ts";
import type { ViewModel } from "../state/view-model.ts";

export interface CommandContext {
  workspace: string;
  // The running model's id, for a command that reports it.
  model: string;
  commands: Command[];
  setSession(session: SessionState | undefined): void;
  // Replaces the whole transcript and the terminal's copy of it. The banner is
  // added by the caller, so no command has to know one exists.
  replaceTranscript(view: ViewModel): void;
  setModel(name: string): void;
  onExit(): void;
}

export interface Command {
  name: string;
  description: string;
  // Refused while a turn is running: these change the conversation under it.
  needsIdle?: boolean;
  run(
    args: string,
    ctx: CommandContext,
  ): Promise<string | undefined> | string | undefined;
}
