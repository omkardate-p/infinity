/**
 * The transcript reducer. Events go in, committed and live items come out.
 * No terminal and no model: a failure here is a reducer bug, not a rendering
 * one, which is the whole point of keeping this layer pure.
 */

import { describe, expect, test } from "bun:test";
import type { AgentEvent } from "../../src/domain/events.ts";
import type { TranscriptItem } from "../../src/domain/messages.ts";
import {
  commitElapsed,
  commitUser,
  empty,
  reduce,
  type ViewModel,
} from "../../src/tui/state/view-model.ts";

function apply(state: ViewModel, ...events: AgentEvent[]): ViewModel {
  return events.reduce(reduce, state);
}

function kinds(items: TranscriptItem[]): string[] {
  return items.map((item) => item.kind);
}

const turnStart: AgentEvent = { type: "turn_start", turn: 1 };

describe("commitUser", () => {
  test("the first message stands alone", () => {
    const state = commitUser(empty(), "fix the bug");

    expect(kinds(state.committed)).toEqual(["user"]);
    expect(state.running).toBe(true);
  });

  test("a later message follows the one before it", () => {
    const first = commitUser(empty(), "fix the bug");
    const state = commitUser(first, "now the tests");

    expect(kinds(state.committed)).toEqual(["user", "user"]);
  });
});

describe("commitElapsed", () => {
  test("records how long the exchange took, which is what separates them", () => {
    const state = commitElapsed(commitUser(empty(), "go"), 12_345, 1_700_000);

    expect(state.committed).toMatchObject([
      { kind: "user" },
      { kind: "elapsed", ms: 12_345, at: 1_700_000 },
    ]);
  });
});

describe("assistant text", () => {
  test("deltas accumulate into one live item", () => {
    const state = apply(
      empty(),
      turnStart,
      { type: "text_delta", text: "I'll " },
      { type: "text_delta", text: "read " },
      { type: "text_delta", text: "it." },
    );

    expect(state.committed).toEqual([]);
    expect(state.live).toMatchObject({
      kind: "assistant",
      text: "I'll read it.",
    });
  });

  test("reasoning is not displayed", () => {
    const state = apply(empty(), turnStart, {
      type: "thinking_delta",
      text: "considering",
    });

    expect(state.committed).toEqual([]);
    expect(state.live).toBeUndefined();
  });

  test("turn_start records the turn without adding an item", () => {
    const state = apply(empty(), { type: "turn_start", turn: 4 });

    expect(state.turn).toBe(4);
    expect(state.committed).toEqual([]);
  });
});

describe("tool calls", () => {
  const start: AgentEvent = {
    type: "tool_start",
    id: "call_1",
    name: "read_file",
    args: { path: "src/cli.ts" },
  };

  test("starting a tool commits the assistant text above it", () => {
    const state = apply(
      empty(),
      turnStart,
      { type: "text_delta", text: "reading" },
      start,
    );

    expect(kinds(state.committed)).toEqual(["assistant"]);
    expect(state.live).toMatchObject({ kind: "tool", status: "running" });
  });

  test("a successful tool commits with its output", () => {
    const state = apply(empty(), turnStart, start, {
      type: "tool_end",
      id: "call_1",
      name: "read_file",
      ok: true,
      content: "82 lines",
    });

    expect(state.live).toBeUndefined();
    expect(state.committed).toMatchObject([
      { kind: "tool", status: "ok", content: "82 lines", name: "read_file" },
    ]);
  });

  test("a denied tool commits as failed", () => {
    const state = apply(empty(), turnStart, start, {
      type: "tool_end",
      id: "call_1",
      name: "read_file",
      ok: false,
      content: "Error: the operator denied it.",
    });

    expect(state.committed).toMatchObject([{ kind: "tool", status: "failed" }]);
  });

  test("an unpaired tool_end is a defect, not something to absorb", () => {
    expect(() =>
      apply(empty(), turnStart, start, {
        type: "tool_end",
        id: "call_other",
        name: "read_file",
        ok: true,
        content: "",
      }),
    ).toThrow("no matching open tool call");
  });

  test("two tools in one turn each commit in order", () => {
    const state = apply(
      empty(),
      turnStart,
      start,
      {
        type: "tool_end",
        id: "call_1",
        name: "read_file",
        ok: true,
        content: "one",
      },
      { type: "tool_start", id: "call_2", name: "shell", args: {} },
      {
        type: "tool_end",
        id: "call_2",
        name: "shell",
        ok: false,
        content: "two",
      },
    );

    expect(state.committed).toMatchObject([
      { kind: "tool", id: "call_1", status: "ok" },
      { kind: "tool", id: "call_2", status: "failed" },
    ]);
  });
});

describe("ending a run", () => {
  test("completing commits the assistant text and says nothing further", () => {
    const state = apply(
      empty(),
      turnStart,
      { type: "text_delta", text: "done." },
      { type: "done", reason: "completed", turns: 2 },
    );

    expect(kinds(state.committed)).toEqual(["assistant"]);
    expect(state.running).toBe(false);
  });

  test("a model error explains itself, so no second line follows", () => {
    const state = apply(
      empty(),
      turnStart,
      { type: "error", error: new Error("connection lost") },
      { type: "done", reason: "model_error", turns: 1 },
    );

    expect(kinds(state.committed)).toEqual(["error"]);
    expect(state.committed[0]).toMatchObject({ message: "connection lost" });
  });

  test.each(["max_turns", "aborted", "denial_limit"] as const)(
    "%s leaves a notice, because nothing else states it",
    (reason) => {
      const state = apply(empty(), turnStart, {
        type: "done",
        reason,
        turns: 3,
      });

      expect(state.committed).toMatchObject([
        { kind: "notice", reason, turns: 3 },
      ]);
    },
  );

  test("interrupting mid-sentence keeps what had arrived", () => {
    const state = apply(
      empty(),
      turnStart,
      { type: "text_delta", text: "I'll check the" },
      { type: "done", reason: "aborted", turns: 1 },
    );

    expect(state.committed).toMatchObject([
      { kind: "assistant", text: "I'll check the" },
      { kind: "notice", reason: "aborted" },
    ]);
  });
});

describe("keys", () => {
  test("every committed item has a distinct key", () => {
    let state = commitUser(empty(), "first");
    state = apply(
      state,
      turnStart,
      { type: "text_delta", text: "looking" },
      { type: "tool_start", id: "a", name: "search", args: {} },
      { type: "tool_end", id: "a", name: "search", ok: true, content: "hit" },
      { type: "text_delta", text: "found it" },
      { type: "done", reason: "completed", turns: 1 },
    );
    state = commitUser(state, "second");
    state = apply(state, { type: "done", reason: "max_turns", turns: 9 });

    const keys = state.committed.map((item) => item.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
