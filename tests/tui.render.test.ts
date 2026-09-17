/**
 * What the transcript actually puts on screen. These assert the rendered text,
 * not the shape of the state, so a component that silently stops drawing an
 * item is caught here rather than by looking at a terminal.
 */

import { describe, expect, test } from "bun:test";
import { renderToString } from "ink";
import { createElement } from "react";
import { Transcript } from "../tui/transcript.tsx";
import { commitUser, empty, reduce, type ViewModel } from "../tui/view-model.ts";

function draw(view: ViewModel): string {
  return renderToString(
    createElement(Transcript, {
      committed: view.committed,
      live: view.live,
      width: 80,
    }),
  );
}

describe("transcript rendering", () => {
  test("a user message and an answer both appear", () => {
    let view = commitUser(empty(), "fix the bug");
    view = reduce(view, { type: "turn_start", turn: 1 });
    view = reduce(view, { type: "text_delta", text: "Looking at it." });

    const screen = draw(view);
    expect(screen).toContain("fix the bug");
    expect(screen).toContain("Looking at it.");
  });

  test("a tool call shows its name and its argument", () => {
    let view = reduce(empty(), { type: "turn_start", turn: 1 });
    view = reduce(view, {
      type: "tool_start",
      id: "c1",
      name: "read_file",
      args: { path: "src/cli.ts" },
    });

    const screen = draw(view);
    expect(screen).toContain("Ran read_file");
    expect(screen).toContain("src/cli.ts");
  });

  test("long output keeps its head and tail and counts what it dropped", () => {
    const content = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    let view = reduce(empty(), { type: "turn_start", turn: 1 });
    view = reduce(view, {
      type: "tool_start",
      id: "c1",
      name: "shell",
      args: { command: "bun test" },
    });
    view = reduce(view, {
      type: "tool_end",
      id: "c1",
      name: "shell",
      ok: true,
      content,
    });

    const screen = draw(view);
    expect(screen).toContain("line 0");
    expect(screen).toContain("line 49");
    expect(screen).toContain("+44 lines");
    expect(screen).not.toContain("line 25");
  });

  test("a failed tool is marked differently from one that worked", () => {
    const base = reduce(empty(), { type: "turn_start", turn: 1 });
    const started = reduce(base, {
      type: "tool_start",
      id: "c1",
      name: "shell",
      args: { command: "bun test" },
    });

    const good = draw(
      reduce(started, {
        type: "tool_end",
        id: "c1",
        name: "shell",
        ok: true,
        content: "pass",
      }),
    );
    const bad = draw(
      reduce(started, {
        type: "tool_end",
        id: "c1",
        name: "shell",
        ok: false,
        content: "Error: denied",
      }),
    );

    expect(good).toContain("●");
    expect(bad).toContain("✗");
  });

  test("an interrupted run says so", () => {
    const view = reduce(reduce(empty(), { type: "turn_start", turn: 1 }), {
      type: "done",
      reason: "aborted",
      turns: 2,
    });

    expect(draw(view)).toContain("Interrupted after 2 turns");
  });

  test("a completed run adds no trailing line", () => {
    let view = reduce(empty(), { type: "turn_start", turn: 1 });
    view = reduce(view, { type: "text_delta", text: "All done." });
    view = reduce(view, { type: "done", reason: "completed", turns: 1 });

    const screen = draw(view);
    expect(screen).toContain("All done.");
    expect(screen).not.toContain("Done after");
  });
});
