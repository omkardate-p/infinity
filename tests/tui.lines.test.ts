/**
 * What a finished transcript item puts on screen, line for line. These run
 * without a terminal: a committed item is written into scrollback as a snapshot
 * that declares its own height, so the exact lines are the contract.
 */

import { describe, expect, test } from "bun:test";
import { cells } from "../tui/format.ts";
import { itemLines, lineText } from "../tui/lines.ts";
import {
  commitUser,
  empty,
  reduce,
  type ViewModel,
} from "../tui/view-model.ts";

const WIDTH = 80;

function draw(view: ViewModel): string[] {
  return view.committed.flatMap((item) => itemLines(item, WIDTH)).map(lineText);
}

describe("transcript lines", () => {
  test("a user message and an answer both appear", () => {
    let view = commitUser(empty(), "fix the bug");
    view = reduce(view, { type: "turn_start", turn: 1 });
    view = reduce(view, { type: "text_delta", text: "Looking at it." });
    view = reduce(view, { type: "done", reason: "completed", turns: 1 });

    const screen = draw(view).join("\n");
    expect(screen).toContain("› fix the bug");
    expect(screen).toContain("● Looking at it.");
  });

  test("a tool call shows its name and its argument", () => {
    let view = reduce(empty(), { type: "turn_start", turn: 1 });
    view = reduce(view, {
      type: "tool_start",
      id: "c1",
      name: "read_file",
      args: { path: "src/cli.ts" },
    });
    view = reduce(view, {
      type: "tool_end",
      id: "c1",
      name: "read_file",
      ok: true,
      content: "82 lines",
    });

    const screen = draw(view).join("\n");
    expect(screen).toContain("Ran read_file");
    expect(screen).toContain("src/cli.ts");
  });

  test("long output keeps its head and tail and counts what it dropped", () => {
    const content = Array.from({ length: 50 }, (_, i) => `line ${i}`).join(
      "\n",
    );
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

    const screen = draw(view).join("\n");
    expect(screen).toContain("line 0");
    expect(screen).toContain("line 49");
    expect(screen).toContain("+44 lines");
    expect(screen).not.toContain("line 25");
  });

  test("a failed tool is marked differently from one that worked", () => {
    const start = reduce(reduce(empty(), { type: "turn_start", turn: 1 }), {
      type: "tool_start",
      id: "c1",
      name: "shell",
      args: { command: "bun test" },
    });
    const good = draw(
      reduce(start, {
        type: "tool_end",
        id: "c1",
        name: "shell",
        ok: true,
        content: "pass",
      }),
    ).join("\n");
    const bad = draw(
      reduce(start, {
        type: "tool_end",
        id: "c1",
        name: "shell",
        ok: false,
        content: "Error: denied",
      }),
    ).join("\n");

    expect(good).toContain("●");
    expect(bad).toContain("✗");
  });

  test("an interrupted run says so, a completed one adds no line", () => {
    const base = reduce(empty(), { type: "turn_start", turn: 1 });

    expect(
      draw(reduce(base, { type: "done", reason: "aborted", turns: 2 })).join(
        "\n",
      ),
    ).toContain("Interrupted after 2 turns");

    expect(
      draw(reduce(base, { type: "done", reason: "completed", turns: 1 })).join(
        "\n",
      ),
    ).not.toContain("Done after");
  });

  test("nothing is drawn wider than the width it was given", () => {
    // A snapshot declares its own height. A line that overruns the width wraps
    // into a row the renderer did not account for, which is how a transcript
    // and the footer below it drift apart.
    const wide = "x".repeat(400);
    let view = commitUser(empty(), wide);
    view = reduce(view, { type: "turn_start", turn: 1 });
    view = reduce(view, { type: "text_delta", text: wide });
    view = reduce(view, {
      type: "tool_start",
      id: "c1",
      name: "shell",
      args: { command: wide },
    });
    view = reduce(view, {
      type: "tool_end",
      id: "c1",
      name: "shell",
      ok: true,
      content: [wide, "\tindented", wide].join("\n"),
    });
    view = reduce(view, { type: "done", reason: "completed", turns: 1 });

    for (const line of draw(view)) {
      expect(cells(line)).toBeLessThanOrEqual(WIDTH);
    }
  });

  test("the banner is a plain block, fitted to the width", () => {
    const view = draw({
      ...empty(),
      committed: [
        {
          key: 0,
          kind: "banner",
          model: "ollama/ornith:9b",
          workspace:
            "/private/var/folders/mq/3h12nst13094g82rv/T/a-very-long-workspace-path",
          version: "0.0.0",
        },
      ],
    });

    expect(view[0]).toBe(">_ infinity v0.0.0");
    expect(view.join("\n")).toContain("ollama/ornith:9b");
    for (const line of view) expect(cells(line)).toBeLessThanOrEqual(WIDTH);
    // No box: nothing here draws a border.
    expect(view.join("")).not.toContain("╭");
    expect(view.join("")).not.toContain("│");
  });
});
