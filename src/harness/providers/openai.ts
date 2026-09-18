/**
 * OpenAI-compatible adapter, pointed at Ollama's /v1 endpoint. Everything this
 * wire format does differently from the native one stays here: SSE framing
 * rather than NDJSON, reasoning under delta.reasoning, arguments as a JSON
 * string, and tool results keyed by tool_call_id alone.
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

const DEFAULT_BASE_URL = "http://localhost:11434/v1";

export interface OpenAIOptions {
  model: string;
  baseUrl?: string;
}

interface WireMessage {
  role: string;
  content: string;
  tool_calls?: {
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }[];
  tool_call_id?: string;
}

interface WireDelta {
  content?: string | null;
  reasoning?: string | null;
  tool_calls?: {
    index?: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  }[];
}

interface WireChunk {
  choices?: { delta?: WireDelta; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number };
  error?: { message?: string };
}

export class OpenAIModel implements Model {
  readonly id: string;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: OpenAIOptions) {
    this.id = options.model;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    // Ollama ignores it; a hosted endpoint rejects the request without one.
    this.apiKey = process.env.OPENAI_API_KEY ?? "ollama";
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelEvent> {
    const body = {
      model: this.id,
      messages: request.messages.map(toWireMessage),
      tools: request.tools.map(toWireTool),
      stream: true,
      // Without this the token counts never arrive on a streamed response.
      stream_options: { include_usage: true },
      ...(request.temperature !== undefined
        ? { temperature: request.temperature }
        : {}),
    };

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        ...(request.signal ? { signal: request.signal } : {}),
      });
    } catch (error) {
      if (isAbort(error)) {
        yield { type: "done", stopReason: "aborted" };
        return;
      }
      yield {
        type: "error",
        error: asError(error, "Failed to reach the OpenAI endpoint"),
      };
      return;
    }

    if (!response.ok || !response.body) {
      const detail = await safeText(response);
      yield {
        type: "error",
        error: new Error(
          `OpenAI endpoint returned ${response.status} ${response.statusText}${detail ? `: ${detail}` : ""}`,
        ),
      };
      return;
    }

    const calls = new ToolCallAccumulator();
    let stopReason: StopReason = "end_turn";
    let promptTokens: number | undefined;

    try {
      for await (const chunk of readSse(response.body)) {
        if (chunk.error) {
          yield {
            type: "error",
            error: new Error(chunk.error.message ?? "unknown error"),
          };
          return;
        }

        const choice = chunk.choices?.[0];
        const delta = choice?.delta;
        if (delta?.reasoning)
          yield { type: "thinking_delta", text: delta.reasoning };
        if (delta?.content) yield { type: "text_delta", text: delta.content };
        if (delta?.tool_calls) calls.add(delta.tool_calls);

        if (choice?.finish_reason)
          stopReason = mapStopReason(choice.finish_reason);
        // The usage arrives after the finish reason, in a chunk carrying no
        // choices at all, so the loop reads on to [DONE] rather than stopping
        // at the last of the text.
        if (chunk.usage?.prompt_tokens !== undefined) {
          promptTokens = chunk.usage.prompt_tokens;
        }
      }
    } catch (error) {
      if (isAbort(error)) {
        yield { type: "done", stopReason: "aborted" };
        return;
      }
      yield { type: "error", error: asError(error, "OpenAI stream failed") };
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

// arguments arrive as a JSON string and may be split across chunks, so the
// fragments are concatenated by index and parsed once at the end.
class ToolCallAccumulator {
  private readonly byIndex = new Map<
    number,
    { id?: string; name: string; args: string }
  >();

  add(calls: NonNullable<WireDelta["tool_calls"]>): void {
    for (const [position, call] of calls.entries()) {
      const index = call.index ?? position;
      const existing = this.byIndex.get(index) ?? { name: "", args: "" };
      this.byIndex.set(index, {
        ...((call.id ?? existing.id) ? { id: call.id ?? existing.id } : {}),
        name: call.function?.name ?? existing.name,
        args: existing.args + (call.function?.arguments ?? ""),
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

function parseArgs(args: string): unknown {
  if (!args) return {};
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
  if (message.toolCalls?.length) {
    wire.tool_calls = message.toolCalls.map((call) => ({
      id: call.id,
      type: "function",
      function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
    }));
  }
  // A tool message is matched by id alone here; the name has nowhere to go.
  if (message.role === "tool" && message.toolCallId)
    wire.tool_call_id = message.toolCallId;
  return wire;
}

function mapStopReason(reason: string): StopReason {
  switch (reason) {
    case "tool_calls":
      return "tool_calls";
    case "length":
      return "length";
    default:
      return "end_turn";
  }
}

async function* readSse(
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
      if (line.startsWith("data:")) {
        const payload = line.slice("data:".length).trim();
        if (payload === "[DONE]") return;
        if (payload) yield JSON.parse(payload) as WireChunk;
      }
      newline = buffer.indexOf("\n");
    }
  }
}
