/**
 * The OpenAI-compatible adapter, against a local server serving the SSE frames
 * we measured from Ollama. Nothing here reaches a model: these tests pin the
 * wire format, so a change in framing or field names fails here rather than
 * mid-run.
 */

import { describe, expect, test } from "bun:test";
import type {
  Message,
  ModelEvent,
  ToolSpec,
} from "../../src/harness/model/types.ts";
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

  test("stops at [DONE] even without a finish reason", async () => {
    const { events } = await serve([delta({ content: "partial" })]);

    expect(events.at(-1)).toEqual({ type: "done", stopReason: "end_turn" });
  });
});
