/**
 * The agent runtime depends on this file and nothing else from the model layer.
 * No provider wire format may leak past this boundary: if a field only exists
 * because Ollama emits it, it belongs in providers/, not here.
 */

export type Role = "system" | "user" | "assistant" | "tool";

/** A tool call as the agent sees it, independent of how a provider encodes one. */
export interface ToolCall {
  /**
   * Provider-assigned identifier for this call. Ollama and OpenAI both supply
   * one; providers that do not must synthesize a stable id so that tool results
   * can be matched back to the call that produced them.
   */
  id: string;
  name: string;
  /** Unvalidated. The tool layer parses this against the tool's input schema. */
  args: unknown;
}

export interface Message {
  role: Role;
  content: unknown;
  /**
   * Reasoning emitted separately from content. Present only on assistant
   * messages, and only for models that expose a distinct reasoning channel.
   */
  thinking?: string;
  /** Present on assistant messages that requested tool execution. */
  toolCalls?: ToolCall[];
  /** Present on tool messages: the id and name of the call being answered. */
  toolCallId?: string;
  name?: string;
}

/** A tool as described to the model. Execution lives in the tool layer. */
export interface ToolSpec {
  name: string;
  description: string;
  /** JSON Schema describing the tool's input object. */
  inputSchema: Record<string, unknown>;
}

export interface ModelRequest {
  messages: Message[];
  tools: ToolSpec[];
  /**
   * Maximum context window in tokens. Sent explicitly rather than relying on a
   * provider or Modelfile default, which varies by tag and is easy to get wrong.
   */
  contextTokens?: number;
  temperature?: number;
  /** Aborts an in-flight request. Wired to Ctrl-C by the CLI. */
  signal?: AbortSignal;
}

export type StopReason = "end_turn" | "tool_calls" | "aborted" | "length";

export type ModelEvent =
  | { type: "text_delta"; text: string }
  /**
   * Reasoning tokens. Separate from text_delta so the CLI can style, collapse
   * or discard reasoning without the agent loop knowing the difference.
   */
  | { type: "thinking_delta"; text: string }
  /** Emitted once per call, after the provider has accumulated the whole call. */
  | { type: "tool_call"; id: string; name: string; args: unknown }
  | { type: "done"; stopReason: StopReason }
  | { type: "error"; error: Error };

export interface Model {
  /** Identifies the backing model in logs and eval records. */
  readonly id: string;
  stream(request: ModelRequest): AsyncIterable<ModelEvent>;
}
