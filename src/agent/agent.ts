/**
 * The agent loop. It asks the model for a turn, shows what the model says,
 * executes whatever tools the model calls, feeds the results back and repeats
 * until the model stops calling tools.
 *
 * There is no planner. The model plans and executes in the same turn; PDF §7.
 * There is also nothing Ollama-specific in this file, which is the property the
 * second provider will test.
 */

import type { Message, Model, ToolCall } from "../model/types.ts";
import type { ApprovalDecision, ApprovalRequest, ToolContext } from "../tools/tool.ts";
import type { ToolRegistry } from "../tools/registry.ts";
import { createSession, saveSession, type SessionState } from "./state.ts";

/**
 * The working contract, and nothing else: what the agent may touch, how it is
 * expected to proceed, and what it may not claim. Resist growing this into an
 * attempt to make the model smarter; PDF §8.
 */
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
  /** Stops a runaway loop. Counted in model turns, not tool calls. */
  maxTurns?: number;
  /**
   * Consecutive denials tolerated before the run stops. Without this, a model
   * that keeps proposing an action the operator will not allow can pin the
   * operator in an approval loop.
   */
  maxConsecutiveDenials?: number;
  contextTokens?: number;
  requestApproval(request: ApprovalRequest): Promise<ApprovalDecision>;
}

export type AgentEvent =
  | { type: "turn_start"; turn: number }
  | { type: "thinking_delta"; text: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_start"; id: string; name: string; args: unknown }
  | { type: "tool_end"; id: string; name: string; ok: boolean; content: string }
  | { type: "done"; reason: AgentStopReason; turns: number }
  | { type: "error"; error: Error };

export type AgentStopReason =
  | "completed"
  | "max_turns"
  | "aborted"
  | "denial_limit"
  | "model_error";

/** One model turn, as the loop needs it once the stream has finished. */
interface TurnResult {
  assistant: Message;
  calls: ToolCall[];
  error?: Error;
}

const DEFAULT_MAX_TURNS = 30;
const DEFAULT_MAX_CONSECUTIVE_DENIALS = 3;
const DEFAULT_CONTEXT_TOKENS = 32768;

export class Agent {
  private readonly model: Model;
  private readonly registry: ToolRegistry;
  private readonly workspace: string;
  private readonly maxTurns: number;
  private readonly maxConsecutiveDenials: number;
  private readonly contextTokens: number;
  private readonly requestApproval: AgentOptions["requestApproval"];

  constructor(options: AgentOptions) {
    this.model = options.model;
    this.registry = options.registry;
    this.workspace = options.workspace;
    this.maxTurns = options.maxTurns ?? DEFAULT_MAX_TURNS;
    this.maxConsecutiveDenials = options.maxConsecutiveDenials ?? DEFAULT_MAX_CONSECUTIVE_DENIALS;
    this.contextTokens = options.contextTokens ?? DEFAULT_CONTEXT_TOKENS;
    this.requestApproval = options.requestApproval;
  }

  /** Starts a new session for a task. */
  start(task: string): SessionState {
    return createSession({
      workspace: this.workspace,
      model: this.model.id,
      task,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: task },
      ],
    });
  }

  /**
   * Runs the loop until the model stops calling tools, a limit is hit, or the
   * signal aborts. The session is mutated in place and saved after every turn,
   * so an interrupted run is still resumable.
   */
  async *run(session: SessionState, signal: AbortSignal): AsyncGenerator<AgentEvent> {
    let consecutiveDenials = 0;
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

      session.messages.push(turn.assistant);
      await saveSession(session);

      if (turn.calls.length === 0) {
        yield { type: "done", reason: "completed", turns: session.turns };
        return;
      }

      for (const call of turn.calls) {
        if (signal.aborted) break;

        yield { type: "tool_start", id: call.id, name: call.name, args: call.args };
        const result = await this.registry.execute(call.name, call.args, this.toolContext(signal));
        yield {
          type: "tool_end",
          id: call.id,
          name: call.name,
          ok: result.ok,
          content: result.content,
        };

        session.messages.push({
          role: "tool",
          content: result.content,
          name: call.name,
          toolCallId: call.id,
        });

        // Counted across turns, not within one, so a model that proposes a
        // rejected action repeatedly still trips the limit.
        consecutiveDenials = result.meta?.reason === "denied" ? consecutiveDenials + 1 : 0;
      }

      await saveSession(session);

      if (consecutiveDenials >= this.maxConsecutiveDenials) {
        yield { type: "done", reason: "denial_limit", turns: session.turns };
        return;
      }
    }
  }

  /**
   * Streams one model turn, forwarding display events as they arrive and
   * returning the assistant message that must be replayed on the next request.
   */
  private async *streamTurn(
    session: SessionState,
    signal: AbortSignal,
  ): AsyncGenerator<AgentEvent, TurnResult> {
    const calls: ToolCall[] = [];
    let text = "";
    let thinking = "";
    let error: Error | undefined;

    const stream = this.model.stream({
      messages: session.messages,
      tools: this.registry.specs(),
      contextTokens: this.contextTokens,
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
          break;
      }
    }

    const assistant: Message = { role: "assistant", content: text };
    if (thinking) assistant.thinking = thinking;
    if (calls.length) assistant.toolCalls = calls;

    return { assistant, calls, ...(error ? { error } : {}) };
  }

  private toolContext(signal: AbortSignal): ToolContext {
    return {
      workspace: this.workspace,
      requestApproval: this.requestApproval,
      signal,
    };
  }
}
