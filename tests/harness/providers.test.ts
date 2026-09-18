/**
 * Both adapters, against a local server replaying the frames we measured from
 * Ollama: NDJSON on the native endpoint, SSE on the OpenAI-compatible one.
 * Nothing here reaches a model. These tests pin the wire format, so a change
 * in framing or field names fails here rather than mid-run.
 */

import { describe, expect, test } from "bun:test";
import type {
  Message,
  ModelEvent,
  ToolSpec,
} from "../../src/harness/model/types.ts";
import { OllamaModel } from "../../src/harness/providers/ollama.ts";
import { OpenAIModel } from "../../src/harness/providers/openai.ts";

const TOOLS: ToolSpec[] = [
  {
    name: "list_dir",
    description: "List a directory.",
    inputSchema: { type: "object", properties: { path: { type: "string" } } },
  },
];

const USER: Message[] = [{ role: "user", content: "list the files" }];

interface SentBody {
  messages: Record<string, unknown>[];
}

interface Served {
  events: ModelEvent[];
  sent: SentBody;
}

// Serves one scripted response, runs a turn against it and shuts the server
// down. Port 0 so parallel test files cannot collide.
async function serve(
  chunks: unknown[],
  options: { status?: number; messages?: Message[] } = {},
): Promise<Served> {
  let sent: SentBody = { messages: [] };

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      sent = (await request.json()) as SentBody;
      if (options.status && options.status !== 200) {
        return new Response("model not found", { status: options.status });
      }
      const body = chunks
        .map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`)
        .join("");
      return new Response(`${body}data: [DONE]\n\n`, {
        headers: { "Content-Type": "text/event-stream" },
      });
    },
  });

  try {
    const model = new OpenAIModel({
      model: "test",
      baseUrl: `http://localhost:${server.port}/v1`,
    });
    const events: ModelEvent[] = [];
    for await (const event of model.stream({
      messages: options.messages ?? USER,
      tools: TOOLS,
    })) {
      events.push(event);
    }
    return { events, sent };
  } finally {
    await server.stop(true);
  }
}

function delta(content: Record<string, unknown>, finish?: string) {
  return { choices: [{ delta: content, finish_reason: finish ?? null }] };
}

// The native endpoint, which is what every real run uses: one JSON object per
// line, and the last one carries the counts.
async function serveNative(
  chunks: unknown[],
  options: { messages?: Message[] } = {},
): Promise<Served> {
  let sent: SentBody = { messages: [] };

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      sent = (await request.json()) as SentBody;
      return new Response(
        chunks.map((chunk) => `${JSON.stringify(chunk)}\n`).join(""),
        { headers: { "Content-Type": "application/x-ndjson" } },
      );
    },
  });

  try {
    const model = new OllamaModel({
      model: "test",
      baseUrl: `http://localhost:${server.port}`,
    });
    const events: ModelEvent[] = [];
    for await (const event of model.stream({
      messages: options.messages ?? USER,
      tools: TOOLS,
    })) {
      events.push(event);
    }
    return { events, sent };
  } finally {
    await server.stop(true);
  }
}

function chunk(message: Record<string, unknown>) {
  return { message, done: false };
}

describe("the native provider", () => {
  test("separates reasoning from text", async () => {
    const { events } = await serveNative([
      chunk({ role: "assistant", thinking: "weighing it up" }),
      chunk({ role: "assistant", content: "here you go" }),
      {
        message: { role: "assistant", content: "" },
        done: true,
        done_reason: "stop",
      },
    ]);

    expect(events).toEqual([
      { type: "thinking_delta", text: "weighing it up" },
      { type: "text_delta", text: "here you go" },
      { type: "done", stopReason: "end_turn" },
    ]);
  });

  test("takes arguments as the object they arrive as", async () => {
    const { events } = await serveNative([
      chunk({
        role: "assistant",
        content: "",
        tool_calls: [
          {
            function: { index: 0, name: "list_dir", arguments: { path: "." } },
          },
        ],
      }),
      {
        message: { role: "assistant", content: "" },
        done: true,
        done_reason: "stop",
      },
    ]);

    expect(events[0]).toEqual({
      type: "tool_call",
      // Ollama assigns no id, so the adapter has to make a stable one.
      id: "call_0",
      name: "list_dir",
      args: { path: "." },
    });
    expect(events.at(-1)).toEqual({ type: "done", stopReason: "tool_calls" });
  });

  test("keeps two calls apart, and joins one split across chunks", async () => {
    const { events } = await serveNative([
      chunk({
        role: "assistant",
        content: "",
        tool_calls: [{ function: { index: 0, name: "list_dir" } }],
      }),
      chunk({
        role: "assistant",
        content: "",
        tool_calls: [{ function: { index: 0, arguments: { path: "src" } } }],
      }),
      chunk({
        role: "assistant",
        content: "",
        tool_calls: [
          {
            function: {
              index: 1,
              name: "read_file",
              arguments: { path: "a.ts" },
            },
          },
        ],
      }),
      { message: { role: "assistant", content: "" }, done: true },
    ]);

    const calls = events.filter((event) => event.type === "tool_call");
    expect(calls).toEqual([
      {
        type: "tool_call",
        id: "call_0",
        name: "list_dir",
        args: { path: "src" },
      },
      {
        type: "tool_call",
        id: "call_1",
        name: "read_file",
        args: { path: "a.ts" },
      },
    ]);
  });

  test("reports a window that ran out as a length stop", async () => {
    const { events } = await serveNative([
      chunk({ role: "assistant", content: "half a sent" }),
      {
        message: { role: "assistant", content: "" },
        done: true,
        done_reason: "length",
      },
    ]);

    expect(events.at(-1)).toEqual({ type: "done", stopReason: "length" });
  });

  test("reports what the model read of what it was sent", async () => {
    const { events } = await serveNative([
      chunk({ role: "assistant", content: "ok" }),
      {
        message: { role: "assistant", content: "" },
        done: true,
        done_reason: "stop",
        prompt_eval_count: 1991,
      },
    ]);

    expect(events.at(-1)).toEqual({
      type: "done",
      stopReason: "end_turn",
      promptTokens: 1991,
    });
  });

  test("an error in the stream is an error event, not a throw", async () => {
    const { events } = await serveNative([{ error: "model not loaded" }]);

    expect(events).toHaveLength(1);
    expect((events[0] as { error: Error }).error.message).toBe(
      "model not loaded",
    );
  });

  test("sends a tool result with both the name and the id", async () => {
    const { sent } = await serveNative(
      [{ message: { role: "assistant", content: "done" }, done: true }],
      {
        messages: [
          { role: "user", content: "list the files" },
          {
            role: "assistant",
            content: "",
            toolCalls: [
              { id: "call_9", name: "list_dir", args: { path: "." } },
            ],
          },
          {
            role: "tool",
            content: "src/",
            name: "list_dir",
            toolCallId: "call_9",
          },
        ],
      },
    );

    const toolMessage = sent.messages[2] as Record<string, unknown>;
    expect(toolMessage.tool_name).toBe("list_dir");
    expect(toolMessage.tool_call_id).toBe("call_9");
  });
});

describe("OpenAI-compatible provider", () => {
  test("separates reasoning from text", async () => {
    const { events } = await serve([
      delta({ reasoning: "thinking about it" }),
      delta({ content: "here you go" }),
      delta({}, "stop"),
    ]);

    expect(events).toEqual([
      { type: "thinking_delta", text: "thinking about it" },
      { type: "text_delta", text: "here you go" },
      { type: "done", stopReason: "end_turn" },
    ]);
  });

  test("parses arguments that arrive as a JSON string", async () => {
    const { events } = await serve([
      delta({
        tool_calls: [
          {
            index: 0,
            id: "call_1",
            function: { name: "list_dir", arguments: '{"path":"."}' },
          },
        ],
      }),
      delta({}, "tool_calls"),
    ]);

    expect(events).toEqual([
      {
        type: "tool_call",
        id: "call_1",
        name: "list_dir",
        args: { path: "." },
      },
      { type: "done", stopReason: "tool_calls" },
    ]);
  });

  test("joins argument fragments split across chunks", async () => {
    const { events } = await serve([
      delta({
        tool_calls: [
          {
            index: 0,
            id: "call_2",
            function: { name: "list_dir", arguments: '{"pa' },
          },
        ],
      }),
      delta({
        tool_calls: [{ index: 0, function: { arguments: 'th":"src"}' } }],
      }),
      delta({}, "tool_calls"),
    ]);

    expect(events[0]).toEqual({
      type: "tool_call",
      id: "call_2",
      name: "list_dir",
      args: { path: "src" },
    });
  });

  test("keeps two concurrent calls apart by index", async () => {
    const { events } = await serve([
      delta({
        tool_calls: [
          {
            index: 0,
            id: "a",
            function: { name: "list_dir", arguments: '{"path":"."}' },
          },
          {
            index: 1,
            id: "b",
            function: { name: "list_dir", arguments: '{"path":"src"}' },
          },
        ],
      }),
      delta({}, "tool_calls"),
    ]);

    const calls = events.filter((event) => event.type === "tool_call");
    expect(calls.map((call) => (call as { id: string }).id)).toEqual([
      "a",
      "b",
    ]);
  });

  test("sends a tool result keyed by tool_call_id", async () => {
    const { sent } = await serve(
      [delta({ content: "done" }), delta({}, "stop")],
      {
        messages: [
          { role: "user", content: "list the files" },
          {
            role: "assistant",
            content: "",
            toolCalls: [
              { id: "call_9", name: "list_dir", args: { path: "." } },
            ],
          },
          {
            role: "tool",
            content: "src/",
            name: "list_dir",
            toolCallId: "call_9",
          },
        ],
      },
    );

    const assistant = sent.messages[1] as {
      tool_calls: { function: { arguments: string } }[];
    };
    expect(assistant.tool_calls[0]?.function.arguments).toBe('{"path":"."}');

    const toolMessage = sent.messages[2] as Record<string, unknown>;
    expect(toolMessage.tool_call_id).toBe("call_9");
    expect(toolMessage.tool_name).toBeUndefined();
  });

  test("reports a failed request as an error event", async () => {
    const { events } = await serve([], { status: 404 });

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("error");
    expect((events[0] as { error: Error }).error.message).toContain("404");
  });

  test("reads the usage that arrives after the finish reason", async () => {
    // It comes in a chunk carrying no choices at all, so an adapter that
    // stopped at the finish reason would never see it.
    const { events, sent } = await serve([
      delta({ content: "ok" }),
      delta({}, "stop"),
      { choices: [], usage: { prompt_tokens: 1991 } },
    ]);

    expect(
      (sent as unknown as { stream_options: unknown }).stream_options,
    ).toEqual({
      include_usage: true,
    });
    expect(events.at(-1)).toEqual({
      type: "done",
      stopReason: "end_turn",
      promptTokens: 1991,
    });
  });

  test("stops at [DONE] even without a finish reason", async () => {
    const { events } = await serve([delta({ content: "partial" })]);

    expect(events.at(-1)).toEqual({ type: "done", stopReason: "end_turn" });
  });
});
