/**
 * What a run reports while it happens, and why it stopped.
 *
 * This is the contract between whatever produces a run and whatever watches
 * one: the agent loop emits these, the interface and the eval harness read
 * them, and neither end knows the other exists. Nothing provider-shaped belongs
 * here — a field that exists because Ollama emits it lives in harness/providers.
 */

export type AgentEvent =
  | { type: "turn_start"; turn: number }
  | { type: "thinking_delta"; text: string }
  | { type: "text_delta"; text: string }
  | { type: "tool_start"; id: string; name: string; args: unknown }
  | { type: "tool_end"; id: string; name: string; ok: boolean; content: string }
  | { type: "context"; promptTokens: number; contextTokens: number }
  | { type: "done"; reason: AgentStopReason; turns: number }
  | { type: "error"; error: Error };

// Truncation was measured at 97% of a 2048-token window, so this is the last
// point at which saying so is still ahead of the loss rather than after it.
export const CONTEXT_FULL = 0.9;

export type AgentStopReason =
  | "completed"
  | "max_turns"
  | "aborted"
  | "denial_limit"
  | "model_error";
