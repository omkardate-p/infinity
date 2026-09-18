/**
 * The agent loop. It asks the model for a turn, shows what the model says,
 * executes whatever tools the model calls, feeds the results back and repeats
 * until the model stops calling tools.
 *
 * There is no planner. The model plans and executes in the same turn; PDF §7.
 * There is also nothing Ollama-specific in this file, which is the property the
 * second provider will test.
 */

import type { AgentEvent } from "../../domain/events.ts";
import type { Message, Model, ToolCall } from "../model/types.ts";
import type { ToolRegistry } from "../tools/registry.ts";
import type {
  ApprovalDecision,
  ApprovalRequest,
  ToolContext,
} from "../tools/tool.ts";
import {
  createSession,
  messagesOf,
  type SessionState,
  saveSession,
} from "./state.ts";

// The working contract only. Growing this to paper over a runtime defect is
// forbidden; PDF §8.
export const SYSTEM_PROMPT = `You are a coding agent operating in the current workspace.

Inspect before editing.
Use tools rather than guessing repository state.
Make the smallest correct change.
Run relevant tests after changes.
If a command fails, inspect the failure and decide the next action.
Do not claim a change succeeded unless you observed the result.
Do not access paths outside the workspace.`;

export interface AgentOptions {
  model: Model;
  registry: ToolRegistry;
  workspace: string;
  maxTurns?: number;
  // Counted for the whole run, not as a streak: an agent that reads a file
  // between two refused commands is still pinning the operator.
  maxDenials?: number;
  requestApproval(request: ApprovalRequest): Promise<ApprovalDecision>;
}

interface TurnResult {
  assistant: Message;
  calls: ToolCall[];
  promptTokens?: number;
  error?: Error;
}

const DEFAULT_MAX_TURNS = 30;
const DEFAULT_MAX_DENIALS = 3;
const DEFAULT_CONTEXT_TOKENS = 32768;

export class Agent {
  private readonly model: Model;
  private readonly registry: ToolRegistry;
  private readonly workspace: string;
  private readonly maxTurns: number;
  private readonly maxDenials: number;
  private readonly requestApproval: AgentOptions["requestApproval"];

  constructor(options: AgentOptions) {
    this.model = options.model;
    this.registry = options.registry;
    this.workspace = options.workspace;
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    this.maxDenials = options.maxDenials ?? DEFAULT_MAX_DENIALS;
    this.requestApproval = options.requestApproval;
  }

  start(task: string): SessionState {
    return createSession({
      workspace: this.workspace,
      model: this.model.id,
      task,
      entries: [
        { message: { role: "system", content: SYSTEM_PROMPT } },
        { message: { role: "user", content: task } },
      ],
    });
  }

  // The session is mutated in place and saved after every turn, so an
  // interrupted run stays resumable.
  async *run(
    session: SessionState,
    signal: AbortSignal,
  ): AsyncGenerator<AgentEvent> {
    session.model = this.model.id;
    let denials = 0;
    // Counted per run, not per session: session.turns is a lifetime total, and
    // a resumed session would otherwise start already over its budget.
    let turnsThisRun = 0;

    while (true) {
      if (signal.aborted) {
        yield { type: "done", reason: "aborted", turns: session.turns };
        return;
      }
      if (turnsThisRun >= this.maxTurns) {
        yield { type: "done", reason: "max_turns", turns: session.turns };
        return;
      }

      turnsThisRun++;
      session.turns++;
      yield { type: "turn_start", turn: session.turns };

      // yield* so display events reach the caller as the model produces them,
      // rather than in a batch once the turn is over.
      const turn = yield* this.streamTurn(session, signal);

      if (turn.error) {
        yield { type: "error", error: turn.error };
        yield { type: "done", reason: "model_error", turns: session.turns };
        return;
      }

      if (turn.promptTokens !== undefined) {
        yield {
          type: "context",
          promptTokens: turn.promptTokens,
          contextTokens: DEFAULT_CONTEXT_TOKENS,
        };
      }

      session.entries.push({ message: turn.assistant });
      await saveSession(session);

      if (turn.calls.length === 0) {
        // An interrupt lands mid-turn, and a cancelled stream ends with no tool
        // calls. Deciding "completed" here, before the loop's own check, is how
        // an abandoned run came to be indistinguishable from a finished one.
        yield {
          type: "done",
          reason: signal.aborted ? "aborted" : "completed",
          turns: session.turns,
        };
        return;
      }

      for (const call of turn.calls) {
        if (signal.aborted) break;

        yield {
          type: "tool_start",
          id: call.id,
          name: call.name,
          args: call.args,
        };
        const result = await this.registry.execute(
          call.name,
          call.args,
          this.toolContext(signal),
        );
        yield {
          type: "tool_end",
          id: call.id,
          name: call.name,
          ok: result.ok,
          content: result.content,
        };

        session.entries.push({
          message: {
            role: "tool",
            content: result.content,
            name: call.name,
            toolCallId: call.id,
          },
          ok: result.ok,
        });

        if (result.meta?.reason === "denied") denials++;
      }

      await saveSession(session);

      if (denials >= this.maxDenials) {
        yield { type: "done", reason: "denial_limit", turns: session.turns };
        return;
      }
    }
  }

  private async *streamTurn(
    session: SessionState,
    signal: AbortSignal,
  ): AsyncGenerator<AgentEvent, TurnResult> {
    const calls: ToolCall[] = [];
    let text = "";
    let thinking = "";
    let promptTokens: number | undefined;
    let error: Error | undefined;

    const stream = this.model.stream({
      messages: messagesOf(session),
      tools: this.registry.specs(),
      contextTokens: DEFAULT_CONTEXT_TOKENS,
      signal,
    });

    for await (const event of stream) {
      switch (event.type) {
        case "thinking_delta":
          thinking += event.text;
          yield { type: "thinking_delta", text: event.text };
          break;
        case "text_delta":
          text += event.text;
          yield { type: "text_delta", text: event.text };
          break;
        case "tool_call":
          calls.push({ id: event.id, name: event.name, args: event.args });
          break;
        case "error":
          error = event.error;
          break;
        case "done":
          promptTokens = event.promptTokens;
          break;
      }
    }

    const assistant: Message = { role: "assistant", content: text };
    if (thinking) assistant.thinking = thinking;
    if (calls.length) assistant.toolCalls = calls;

    return {
      assistant,
      calls,
      ...(promptTokens !== undefined ? { promptTokens } : {}),
      ...(error ? { error } : {}),
    };
  }

  private toolContext(signal: AbortSignal): ToolContext {
    return {
      workspace: this.workspace,
      requestApproval: this.requestApproval,
      signal,
    };
  }
}
