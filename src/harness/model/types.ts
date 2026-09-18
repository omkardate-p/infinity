/**
 * The agent runtime depends on this file and nothing else from the model layer.
 * No provider wire format may leak past this boundary: if a field only exists
 * because Ollama emits it, it belongs in providers/, not here.
 */

export type Role = "system" | "user" | "assistant" | "tool";

export interface ToolCall {
  // A provider that assigns no id must synthesize a stable one, or tool results
  // cannot be matched back to the call that produced them.
  id: string;
  name: string;
  args: unknown;
}

export interface Message {
  role: Role;
  content: unknown;
  thinking?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  name?: string;
}

export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ModelRequest {
  messages: Message[];
  tools: ToolSpec[];
  // Sent explicitly because a bare tag's window comes from whatever Modelfile
  // produced it.
  contextTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export type StopReason = "end_turn" | "tool_calls" | "aborted" | "length";

export type ModelEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; text: string }
  | { type: "tool_call"; id: string; name: string; args: unknown }
  | { type: "done"; stopReason: StopReason }
  | { type: "error"; error: Error };

export interface Model {
  readonly id: string;
  stream(request: ModelRequest): AsyncIterable<ModelEvent>;
}
