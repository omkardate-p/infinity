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
  | { type: "done"; reason: AgentStopReason; turns: number }
  | { type: "error"; error: Error };

export type AgentStopReason =
  | "completed"
  | "max_turns"
  | "aborted"
  | "denial_limit"
  | "model_error";
