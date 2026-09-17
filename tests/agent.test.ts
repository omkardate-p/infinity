/**
 * The loop, driven by a scripted model. Nothing here reaches Ollama: a failure
 * means the runtime is wrong, not that a model had an off day.
 */

import { describe, expect, test } from "bun:test";
import { Agent, type AgentEvent } from "../src/agent/agent.ts";
import { loadSession } from "../src/agent/state.ts";
import { ToolRegistry } from "../src/tools/registry.ts";
import { fail, ok, type Tool } from "../src/tools/tool.ts";
import type { Model, ModelEvent, ModelRequest } from "../src/model/types.ts";
import { makeWorkspace } from "./helpers.ts";

type ScriptedTurn =
  | { text: string; calls?: { name: string; args: unknown }[] }
  | { error: string };

class ScriptedModel implements Model {
  readonly id = "scripted";
  readonly requests: ModelRequest[] = [];
  private index = 0;

  constructor(private readonly script: ScriptedTurn[]) {}

  async *stream(request: ModelRequest): AsyncIterable<ModelEvent> {
    this.requests.push({ ...request, messages: [...request.messages] });
    const turn = this.script[this.index++] ?? { text: "done" };

    if ("error" in turn) {
      yield { type: "error", error: new Error(turn.error) };
      return;
    }

    yield { type: "thinking_delta", text: "considering" };
    for (const character of turn.text)
      yield { type: "text_delta", text: character };
    for (const [index, call] of (turn.calls ?? []).entries()) {
      yield {
        type: "tool_call",
        id: `call_${this.index}_${index}`,
        name: call.name,
        args: call.args,
      };
    }
    yield {
      type: "done",
      stopReason: turn.calls?.length ? "tool_calls" : "end_turn",
    };
  }
}

const noteTool: Tool = {
  name: "note",
  description: "Record a note and return it.",
  inputSchema: {
    type: "object",
    required: ["text"],
    properties: { text: { type: "string" } },
    additionalProperties: false,
  },
  async execute(input) {
    return ok(`noted: ${(input as { text: string }).text}`);
  },
};

function makeBrittleTool(): Tool {
  let calls = 0;
  return {
    name: "brittle",
    description: "Fails the first time it is called, then succeeds.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    async execute() {
      return ++calls === 1
        ? fail("transient failure; try again")
        : ok("recovered");
    },
  };
}

const gatedTool: Tool = {
  name: "gated",
  description: "Requires approval before doing anything.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  async execute(_input, ctx) {
    const decision = await ctx.requestApproval({
      tool: "gated",
      summary: "do the thing",
    });
    return decision === "deny"
      ? fail("the operator denied it.", { reason: "denied" })
      : ok("did it");
  },
};

async function collect(
  agent: Agent,
  task: string,
  signal = new AbortController().signal,
): Promise<{
  events: AgentEvent[];
  session: Awaited<ReturnType<Agent["start"]>>;
}> {
  const session = agent.start(task);
  const events: AgentEvent[] = [];
  for await (const event of agent.run(session, signal)) events.push(event);
  return { events, session };
}

function makeAgent(
  ws: Awaited<ReturnType<typeof makeWorkspace>>,
  model: Model,
  tools: Tool[],
  overrides: Partial<ConstructorParameters<typeof Agent>[0]> = {},
) {
  return new Agent({
    model,
    registry: new ToolRegistry(tools),
    workspace: ws.root,
    requestApproval: ws.ctx.requestApproval,
    ...overrides,
  });
}

describe("agent loop", () => {
  test("returns the final answer when the model calls no tools", async () => {
    const ws = await makeWorkspace();
    const model = new ScriptedModel([{ text: "nothing to do" }]);

    const { events } = await collect(
      makeAgent(ws, model, [noteTool]),
      "look around",
    );

    const done = events.at(-1);
    expect(done).toEqual({ type: "done", reason: "completed", turns: 1 });
    // One turn only: the agent must not take a further turn to say it is done.
    expect(model.requests).toHaveLength(1);
  });

  test("streams thinking and text separately as they arrive", async () => {
    const ws = await makeWorkspace();
    const model = new ScriptedModel([{ text: "hi" }]);

    const { events } = await collect(makeAgent(ws, model, [noteTool]), "greet");

    expect(
      events.filter((event) => event.type === "thinking_delta"),
    ).toHaveLength(1);
    expect(events.filter((event) => event.type === "text_delta")).toHaveLength(
      2,
    );
  });

  test("feeds a tool result back and continues until the model stops", async () => {
    const ws = await makeWorkspace();
    const model = new ScriptedModel([
      { text: "checking", calls: [{ name: "note", args: { text: "one" } }] },
      { text: "all done" },
    ]);

    const { events, session } = await collect(
      makeAgent(ws, model, [noteTool]),
      "note something",
    );

    expect(events.at(-1)).toEqual({
      type: "done",
      reason: "completed",
      turns: 2,
    });
    const toolEntry = session.entries.find(
      (entry) => entry.message.role === "tool",
    );
    expect(toolEntry?.message.content).toBe("noted: one");
    expect(toolEntry?.message.name).toBe("note");
    expect(toolEntry?.ok).toBe(true);
    // The second request must carry the assistant tool call and its result.
    const second = model.requests[1]!;
    expect(second.messages.some((message) => message.toolCalls?.length)).toBe(
      true,
    );
    expect(second.messages.some((message) => message.role === "tool")).toBe(
      true,
    );
  });

  test("executes several tool calls from one turn in order", async () => {
    const ws = await makeWorkspace();
    const model = new ScriptedModel([
      {
        text: "two things",
        calls: [
          { name: "note", args: { text: "first" } },
          { name: "note", args: { text: "second" } },
        ],
      },
      { text: "done" },
    ]);

    const { events } = await collect(
      makeAgent(ws, model, [noteTool]),
      "note twice",
    );

    const results = events.filter((event) => event.type === "tool_end");
    expect(
      results.map((event) => (event as { content: string }).content),
    ).toEqual(["noted: first", "noted: second"]);
  });

  test("passes an unknown tool back as a structured error the model can recover from", async () => {
    const ws = await makeWorkspace();
    const model = new ScriptedModel([
      { text: "guessing", calls: [{ name: "teleport", args: {} }] },
      {
        text: "using a real tool instead",
        calls: [{ name: "note", args: { text: "ok" } }],
      },
      { text: "done" },
    ]);

    const { events } = await collect(
      makeAgent(ws, model, [noteTool]),
      "do something",
    );

    const firstResult = events.find((event) => event.type === "tool_end") as {
      ok: boolean;
      content: string;
    };
    expect(firstResult.ok).toBe(false);
    expect(firstResult.content).toContain("unknown tool");
    expect(events.at(-1)).toEqual({
      type: "done",
      reason: "completed",
      turns: 3,
    });
  });

  test("passes a tool failure back and lets the model retry", async () => {
    const ws = await makeWorkspace();
    const model = new ScriptedModel([
      { text: "first attempt", calls: [{ name: "brittle", args: {} }] },
      { text: "second attempt", calls: [{ name: "brittle", args: {} }] },
      { text: "done" },
    ]);

    const { events } = await collect(
      makeAgent(ws, model, [makeBrittleTool()]),
      "use the brittle tool",
    );

    const results = events.filter((event) => event.type === "tool_end") as {
      ok: boolean;
    }[];
    expect(results.map((result) => result.ok)).toEqual([false, true]);
  });

  test("stops after the configured number of denials", async () => {
    const ws = await makeWorkspace({ approval: "deny" });
    const model = new ScriptedModel(
      Array.from({ length: 10 }, () => ({
        text: "again",
        calls: [{ name: "gated", args: {} }],
      })),
    );

    const { events } = await collect(
      makeAgent(ws, model, [gatedTool], { maxDenials: 2 }),
      "do the gated thing",
    );

    expect(events.at(-1)).toEqual({
      type: "done",
      reason: "denial_limit",
      turns: 2,
    });
  });

  test("counts denials across a run rather than as a streak", async () => {
    const ws = await makeWorkspace({ approval: "deny" });
    const model = new ScriptedModel(
      Array.from({ length: 10 }, () => ({
        text: "trying again",
        calls: [
          { name: "note", args: { text: "looking around" } },
          { name: "gated", args: {} },
        ],
      })),
    );

    const { events } = await collect(
      makeAgent(ws, model, [noteTool, gatedTool], { maxDenials: 2 }),
      "do the gated thing",
    );

    expect(events.at(-1)).toEqual({
      type: "done",
      reason: "denial_limit",
      turns: 2,
    });
  });

  test("stops at the turn limit", async () => {
    const ws = await makeWorkspace();
    const model = new ScriptedModel(
      Array.from({ length: 20 }, () => ({
        text: "loop",
        calls: [{ name: "note", args: { text: "x" } }],
      })),
    );

    const { events } = await collect(
      makeAgent(ws, model, [noteTool], { maxTurns: 3 }),
      "loop forever",
    );

    expect(events.at(-1)).toEqual({
      type: "done",
      reason: "max_turns",
      turns: 3,
    });
  });

  test("reports a model error and stops rather than looping", async () => {
    const ws = await makeWorkspace();
    const model = new ScriptedModel([{ error: "connection refused" }]);

    const { events } = await collect(
      makeAgent(ws, model, [noteTool]),
      "anything",
    );

    expect(events.at(-2)).toMatchObject({ type: "error" });
    expect(events.at(-1)).toMatchObject({
      type: "done",
      reason: "model_error",
    });
  });

  test("stops when the run is aborted", async () => {
    const ws = await makeWorkspace();
    const controller = new AbortController();
    controller.abort();
    const model = new ScriptedModel([{ text: "never runs" }]);

    const { events } = await collect(
      makeAgent(ws, model, [noteTool]),
      "anything",
      controller.signal,
    );

    expect(events).toEqual([{ type: "done", reason: "aborted", turns: 0 }]);
  });

  test("saves the session so it can be resumed", async () => {
    const ws = await makeWorkspace();
    const model = new ScriptedModel([
      { text: "checking", calls: [{ name: "note", args: { text: "one" } }] },
      { text: "done" },
    ]);

    const { session } = await collect(
      makeAgent(ws, model, [noteTool]),
      "note something",
    );
    const reloaded = await loadSession(ws.root, session.id);

    expect(reloaded.turns).toBe(2);
    expect(reloaded.task).toBe("note something");
    expect(reloaded.entries.map((entry) => entry.message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "tool",
      "assistant",
    ]);
  });
});

describe("resume", () => {
  test("records whether each tool call succeeded, across a save and load", async () => {
    const ws = await makeWorkspace();
    const model = new ScriptedModel([
      { text: "first go", calls: [{ name: "brittle", args: {} }] },
      { text: "second go", calls: [{ name: "brittle", args: {} }] },
      { text: "done" },
    ]);

    const { session } = await collect(
      makeAgent(ws, model, [makeBrittleTool()]),
      "use the brittle tool",
    );
    const reloaded = await loadSession(ws.root, session.id);

    const outcomes = reloaded.entries
      .filter((entry) => entry.message.role === "tool")
      .map((entry) => entry.ok);
    expect(outcomes).toEqual([false, true]);
  });

  test("gives a resumed session a fresh turn budget", async () => {
    const ws = await makeWorkspace();
    const first = new ScriptedModel(
      Array.from({ length: 5 }, () => ({
        text: "loop",
        calls: [{ name: "note", args: { text: "x" } }],
      })),
    );

    const { session } = await collect(
      makeAgent(ws, first, [noteTool], { maxTurns: 3 }),
      "keep going",
    );
    expect(session.turns).toBe(3);

    // Resuming with the same limit must run again rather than stopping at once.
    const second = new ScriptedModel([{ text: "finally done" }]);
    const resumed = makeAgent(ws, second, [noteTool], { maxTurns: 3 });
    const events: AgentEvent[] = [];
    session.entries.push({ message: { role: "user", content: "continue" } });
    for await (const event of resumed.run(
      session,
      new AbortController().signal,
    ))
      events.push(event);

    expect(events.at(-1)).toEqual({
      type: "done",
      reason: "completed",
      turns: 4,
    });
  });
});
