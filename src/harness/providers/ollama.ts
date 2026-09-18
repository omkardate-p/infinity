/**
 * Ollama adapter. Everything specific to Ollama's wire format lives here:
 * the /api/chat endpoint, its NDJSON stream framing, its tool call encoding
 * and its option names. The rest of the agent sees only model/types.ts.
 */

import type {
  Message,
  Model,
  ModelEvent,
  ModelRequest,
  StopReason,
} from "../model/types.ts";
import {
  asError,
  isAbort,
  safeText,
  stringifyContent,
  toWireTool,
} from "./wire.ts";

const DEFAULT_BASE_URL = "http://localhost:11434";

export interface OllamaOptions {
  model: string;
  baseUrl?: string;
}

interface WireMessage {
  role: string;
  content: string;
  thinking?: string;
  tool_calls?: WireToolCall[];
  tool_name?: string;
  tool_call_id?: string;
}

interface WireToolCall {
  id?: string;
  function?: {
    index?: number;
    name?: string;
    // Ollama sends a parsed object here; OpenAI sends a JSON string.
    arguments?: unknown;
  };
}

interface WireChunk {
  message?: {
    role?: string;
    content?: string;
    thinking?: string;
    tool_calls?: WireToolCall[];
  };
  done?: boolean;
  done_reason?: string;
  prompt_eval_count?: number;
  error?: string;
}

export class OllamaModel implements Model {
  readonly id: string;
  private readonly baseUrl: string;

  constructor(options: OllamaOptions) {
    this.id = options.model;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelEvent> {
    const body = {
      model: this.id,
      messages: request.messages.map(toWireMessage),
      tools: request.tools.map(toWireTool),
      stream: true,
      // think:false does not silence reasoning, it only stops the separation:
      // reasoning then arrives inside content with an unbalanced closing tag.
      think: true,
      options: {
        ...(request.contextTokens !== undefined
          ? { num_ctx: request.contextTokens }
          : {}),
        ...(request.temperature !== undefined
          ? { temperature: request.temperature }
          : {}),
      },
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        ...(request.signal ? { signal: request.signal } : {}),
      });
    } catch (error) {
      if (isAbort(error)) {
        yield { type: "done", stopReason: "aborted" };
        return;
      }
      yield { type: "error", error: asError(error, "Failed to reach Ollama") };
      return;
    }

    if (!response.ok || !response.body) {
      const detail = await safeText(response);
      yield {
        type: "error",
        error: new Error(
          `Ollama returned ${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`,
        ),
      };
      return;
    }

    const calls = new ToolCallAccumulator();
    let stopReason: StopReason = "end_turn";
    let promptTokens: number | undefined;

    try {
      for await (const chunk of readNdjson(response.body)) {
        if (chunk.error) {
          yield { type: "error", error: new Error(chunk.error) };
          return;
        }

        const message = chunk.message;
        if (message?.thinking) {
          yield { type: "thinking_delta", text: message.thinking };
        }
        if (message?.content) {
          yield { type: "text_delta", text: message.content };
        }
        if (message?.tool_calls) {
          calls.add(message.tool_calls);
        }

        if (chunk.done) {
          stopReason = mapStopReason(chunk.done_reason, calls.size > 0);
          promptTokens = chunk.prompt_eval_count;
          break;
        }
      }
    } catch (error) {
      if (isAbort(error)) {
        yield { type: "done", stopReason: "aborted" };
        return;
      }
      yield { type: "error", error: asError(error, "Ollama stream failed") };
      return;
    }

    for (const call of calls.drain()) {
      yield {
        type: "tool_call",
        id: call.id,
        name: call.name,
        args: call.args,
      };
    }
    yield {
      type: "done",
      stopReason,
      ...(promptTokens !== undefined ? { promptTokens } : {}),
    };
  }
}

// Calls may arrive whole in one chunk or split across chunks keyed by index;
// accumulating by index handles both without assuming either.
class ToolCallAccumulator {
  private readonly byIndex = new Map<
    number,
    { id?: string; name: string; args: unknown }
  >();

  get size(): number {
    return this.byIndex.size;
  }

  add(calls: WireToolCall[]): void {
    for (const [position, call] of calls.entries()) {
      const index = call.function?.index ?? position;
      const existing = this.byIndex.get(index) ?? { name: "", args: undefined };
      this.byIndex.set(index, {
        ...((call.id ?? existing.id) ? { id: call.id ?? existing.id } : {}),
        name: call.function?.name ?? existing.name,
        args: call.function?.arguments ?? existing.args,
      });
    }
  }

  drain(): { id: string; name: string; args: unknown }[] {
    const drained = [...this.byIndex.entries()]
      .sort(([a], [b]) => a - b)
      .map(([index, call]) => ({
        id: call.id ?? `call_${index}`,
        name: call.name,
        args: parseArgs(call.args),
      }));
    this.byIndex.clear();
    return drained;
  }
}

// Ollama sends an object; a JSON string is accepted for provider parity.
function parseArgs(args: unknown): unknown {
  if (typeof args !== "string") return args ?? {};
  try {
    return JSON.parse(args);
  } catch {
    return args;
  }
}

function toWireMessage(message: Message): WireMessage {
  const wire: WireMessage = {
    role: message.role,
    content: stringifyContent(message.content),
  };
  if (message.thinking) wire.thinking = message.thinking;
  if (message.toolCalls?.length) {
    wire.tool_calls = message.toolCalls.map((call, index) => ({
      id: call.id,
      function: { index, name: call.name, arguments: call.args },
    }));
  }
  if (message.role === "tool") {
    if (message.name) wire.tool_name = message.name;
    if (message.toolCallId) wire.tool_call_id = message.toolCallId;
  }
  return wire;
}

function mapStopReason(
  reason: string | undefined,
  hadToolCalls: boolean,
): StopReason {
  if (hadToolCalls) return "tool_calls";
  switch (reason) {
    case "length":
      return "length";
    case "abort":
      return "aborted";
    default:
      return "end_turn";
  }
}

async function* readNdjson(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<WireChunk> {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const bytes of body) {
    buffer += decoder.decode(bytes, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as WireChunk;
      newline = buffer.indexOf("\n");
    }
  }

  const tail = buffer.trim();
  if (tail) yield JSON.parse(tail) as WireChunk;
}
