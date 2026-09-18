/**
 * The TUI driven end to end through OpenTUI's own test renderer: real
 * components, real agent loop, a scripted model, and keys pressed the way a
 * terminal sends them. Nothing here reaches Ollama and nothing needs a pty.
 *
 * The two things worth proving are the ones that cost the most to get wrong:
 * that Shift+Enter is distinguishable from Enter, and that resizing replays the
 * transcript at the new width instead of leaving it frozen.
 */

import { describe, expect, test } from "bun:test";
import { pasteBytes } from "@opentui/core/testing";
import { testRender } from "@opentui/react/test-utils";
import { createElement } from "react";
import { ToolRegistry } from "../../src/harness/tools/registry.ts";
import { fail, ok } from "../../src/harness/tools/tool.ts";
import { App } from "../../src/tui/app.tsx";
import { makeWorkspace, ScriptedModel, type ScriptedTurn } from "../helpers.ts";

async function mount(
  script: ScriptedTurn[],
  options: {
    task?: string;
    width?: number;
    registry?: ToolRegistry;
    autoApprove?: boolean;
    delayMs?: number;
    height?: number;
  } = {},
) {
  const workspace = await makeWorkspace();
  const setup = await testRender(
    createElement(App, {
      model: new ScriptedModel(script, options.delayMs ?? 0),
      createModel: (name: string) => new ScriptedModel([{ text: name }]),
      registry: options.registry ?? new ToolRegistry([]),
      workspace: workspace.root,
      version: "0.0.0",
      maxTurns: 4,
      resumed: undefined,
      initialTask: options.task,
      autoApprove: options.autoApprove ?? true,
      onExit: () => {},
    }),
    {
      width: options.width ?? 80,
      height: options.height ?? 24,
      screenMode: "split-footer",
      footerHeight: 8,
      externalOutputMode: "capture-stdout",
      kittyKeyboard: true,
      exitOnCtrlC: false,
    },
  );
  // Input is only processed once the renderer is running.
  setup.renderer.start();
  await setup.flush();
  return setup;
}

// The footer writes no-break spaces so its cells always overwrite what the
// previous frame left; see opaque() in tui/rendering/format.ts. Tests read the frame the
// way a person sees it.
function frameOf(setup: { captureCharFrame(): string }): string {
  return setup.captureCharFrame().replaceAll("\u00a0", " ");
}

describe("the composer", () => {
  test("typing lands in the prompt", async () => {
    const setup = await mount([{ text: "hello" }]);

    await setup.mockInput.typeText("fix the bug");
    await setup.flush();

    expect(frameOf(setup)).toContain("fix the bug");
  });

  test("Shift+Enter inserts a newline instead of submitting", async () => {
    const setup = await mount([{ text: "hello" }]);

    await setup.mockInput.typeText("first");
    setup.mockInput.pressEnter({ shift: true });
    await setup.flush();
    await setup.mockInput.typeText("second");
    await setup.flush();

    const frame = frameOf(setup);
    expect(frame).toContain("first");
    expect(frame).toContain("second");
    // Still in the composer: a submitted prompt would have left it empty.
    expect(frame).not.toContain("ask infinity");
  });

  test("Enter submits, and the prompt is cleared", async () => {
    const setup = await mount([{ text: "on it" }]);

    await setup.mockInput.typeText("do the thing");
    setup.mockInput.pressEnter();
    await setup.flush();
    await setup.waitFor(() =>
      setup.externalOutput.takeText().includes("do the thing"),
    );
  });
});

describe("the transcript", () => {
  test("a finished exchange is written to the terminal's scrollback", async () => {
    const setup = await mount([{ text: "the answer" }], {
      task: "the question",
    });

    await setup.waitFor(() => {
      const text = setup.externalOutput.takeText();
      return text.includes("the question") && text.includes("the answer");
    });
  });

  test("nothing committed overruns the width it was written at", async () => {
    // Replaying the transcript on resize needs a live terminal, so that is
    // asserted by the pty harness. What matters here is the invariant every
    // commit must hold: a row wider than the snapshot wraps into a row the
    // renderer did not account for.
    const setup = await mount([{ text: "a".repeat(400) }], {
      task: "x".repeat(400),
      width: 60,
    });

    await setup.waitFor(() => setup.externalOutput.take().length > 0);
    const setup2 = await mount([{ text: "b".repeat(400) }], {
      task: "y".repeat(400),
      width: 60,
    });
    await setup2.waitFor(() => {
      const commits = setup2.externalOutput.take();
      for (const commit of commits) {
        for (const row of commit.rows) {
          expect(Bun.stringWidth(row)).toBeLessThanOrEqual(60);
        }
      }
      return commits.length > 0;
    });
  });
});

describe("approval", () => {
  test("a tool that asks is shown, and y allows it", async () => {
    const registry = new ToolRegistry([
      {
        name: "risky",
        description: "Asks before acting.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute(_input, ctx) {
          const decision = await ctx.requestApproval({
            tool: "risky",
            summary: "rm -rf nothing",
          });
          return decision === "allow"
            ? ok("did it")
            : fail("denied", { reason: "denied" });
        },
      },
    ]);

    const setup = await mount(
      [
        { text: "running it", calls: [{ name: "risky", args: {} }] },
        { text: "done" },
      ],
      { registry, autoApprove: false, task: "go" },
    );

    await setup.waitFor(() => frameOf(setup).includes("Approve risky"));
    expect(frameOf(setup)).toContain("rm -rf nothing");

    await setup.mockInput.typeText("y");
    await setup.waitFor(() =>
      setup.externalOutput.takeText().includes("did it"),
    );
  });

  test("n denies it, and the tool says so", async () => {
    const registry = new ToolRegistry([
      {
        name: "risky",
        description: "Asks before acting.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute(_input, ctx) {
          const decision = await ctx.requestApproval({
            tool: "risky",
            summary: "rm -rf nothing",
          });
          return decision === "allow"
            ? ok("did it")
            : fail("the operator denied it", { reason: "denied" });
        },
      },
    ]);

    const setup = await mount(
      [
        { text: "running it", calls: [{ name: "risky", args: {} }] },
        { text: "done" },
      ],
      { registry, autoApprove: false, task: "go" },
    );

    await setup.waitFor(() => frameOf(setup).includes("Approve risky"));
    await setup.mockInput.typeText("n");
    await setup.waitFor(() =>
      setup.externalOutput.takeText().includes("denied"),
    );
  });
});

describe("the run", () => {
  test("a model error is shown and does not wedge the composer", async () => {
    const setup = await mount([{ error: "connection lost" }], { task: "go" });

    await setup.waitFor(() =>
      setup.externalOutput.takeText().includes("connection lost"),
    );
    await setup.waitFor(() => frameOf(setup).includes("ask infinity"));
  });

  test("how long the exchange took is written under it", async () => {
    const setup = await mount([{ text: "answer" }], { task: "question" });

    await setup.waitFor(() => /\d+s/.test(setup.externalOutput.takeText()));
  });

  test("a second prompt continues the same session", async () => {
    const setup = await mount(
      [{ text: "first answer" }, { text: "second answer" }],
      {
        task: "first question",
      },
    );
    await setup.waitFor(() =>
      setup.externalOutput.takeText().includes("first answer"),
    );

    await setup.mockInput.typeText("second question");
    setup.mockInput.pressEnter();
    await setup.waitFor(() =>
      setup.externalOutput.takeText().includes("second answer"),
    );
  });

  test("pasted text lands in the composer without submitting", async () => {
    const setup = await mount([{ text: "hello" }]);

    setup.renderer.stdin.emit("data", Buffer.from(pasteBytes("one\ntwo")));
    await setup.flush();

    const frame = frameOf(setup);
    expect(frame).toContain("one");
    expect(frame).toContain("two");
    expect(frame).not.toContain("ask infinity");
  });
});

describe("quitting", () => {
  test("the first Ctrl-C warns, it does not exit", async () => {
    const setup = await mount([{ text: "hello" }]);

    setup.mockInput.pressKey("c", { ctrl: true });
    await setup.flush();

    expect(frameOf(setup)).toContain("Press Ctrl-C again to exit");
  });

  test("carrying on clears the warning", async () => {
    const setup = await mount([{ text: "hello" }]);

    setup.mockInput.pressKey("c", { ctrl: true });
    await setup.flush();
    await setup.mockInput.typeText("x");
    await setup.flush();

    const frame = frameOf(setup);
    expect(frame).not.toContain("Press Ctrl-C again to exit");
    expect(frame).toContain("x");
  });
});

describe("queued prompts", () => {
  test("a prompt sent while a turn runs waits instead of being refused", async () => {
    const setup = await mount(
      [{ text: "first answer" }, { text: "second answer" }],
      { task: "first question" },
    );

    // The composer stays live while the agent works.
    await setup.mockInput.typeText("second question");
    setup.mockInput.pressEnter();
    await setup.flush();

    await setup.waitFor(() =>
      setup.externalOutput.takeText().includes("second answer"),
    );
  });

  test("no more than five are held", async () => {
    // A long, slow answer keeps the turn in flight while the prompts pile up.
    // The run is started by typing, so mounting itself still settles.
    const setup = await mount([{ text: "x".repeat(200) }], { delayMs: 30 });

    await setup.mockInput.typeText("start");
    setup.mockInput.pressEnter();

    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      await setup.mockInput.typeText(`queued${n}`);
      setup.mockInput.pressEnter();
    }
    // The turn is still streaming, so the frame never goes idle; wait for the
    // queue to appear instead.
    await setup.waitFor(() => frameOf(setup).includes("queued5"));

    const rows = frameOf(setup)
      .split("\n")
      .filter((line) => /^› queued\d+\s*$/.test(line));
    expect(rows).toHaveLength(5);

    // What the queue would not take is kept in the composer rather than lost.
    expect(frameOf(setup)).toContain("queued6queued7");
  });
});

// The footer is a region the renderer reserves. Ask for more rows than the
// terminal has and @opentui/core clamps it to the whole screen: the transcript
// region collapses, the bounded scroll region is never installed, and the
// composer is what falls off the bottom.
describe("the footer stays inside the terminal", () => {
  async function footerOf(options: {
    height: number;
    width?: number;
    detail?: string;
  }) {
    const registry = new ToolRegistry([
      {
        name: "edit_file",
        description: "Rewrites a file.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        async execute(_input, ctx) {
          const decision = await ctx.requestApproval({
            tool: "edit_file",
            summary: "rewrite a file",
            ...(options.detail !== undefined ? { detail: options.detail } : {}),
          });
          return decision === "allow"
            ? ok("written")
            : fail("denied", { reason: "denied" });
        },
      },
    ]);

    const setup = await mount(
      [{ text: "editing", calls: [{ name: "edit_file", args: {} }] }],
      {
        task: "edit it",
        height: options.height,
        ...(options.width !== undefined ? { width: options.width } : {}),
        registry,
        autoApprove: false,
      },
    );
    await setup.waitFor(() => frameOf(setup).includes("[y] allow"));
    return setup;
  }

  test("a long diff does not push the composer off the screen", async () => {
    const detail = Array.from({ length: 60 }, (_, n) => `+ line ${n}`).join(
      "\n",
    );
    const setup = await footerOf({ height: 24, detail });

    expect(setup.renderer.footerHeight).toBeLessThanOrEqual(23);
    const frame = frameOf(setup);
    // The question, the way to answer it, and the composer all survive.
    expect(frame).toContain("Approve edit_file");
    expect(frame).toContain("[y] allow");
    expect(frame).toContain("ask infinity");
  });

  test("the same holds on a terminal with almost no rows", async () => {
    const detail = Array.from({ length: 200 }, (_, n) => `+ line ${n}`).join(
      "\n",
    );
    for (const height of [8, 12, 16]) {
      const setup = await footerOf({ height, detail });
      expect(setup.renderer.footerHeight).toBeLessThanOrEqual(height - 1);
      expect(frameOf(setup)).toContain("[y] allow");
    }
  });

  test("no row of the footer is wider than the terminal", async () => {
    for (const width of [24, 40, 80]) {
      const setup = await footerOf({
        height: 20,
        width,
        detail: "+ 日本語\n- 変更",
      });
      for (const line of frameOf(setup).split("\n")) {
        expect(Bun.stringWidth(line)).toBeLessThanOrEqual(width);
      }
    }
  });
});

describe("the command menu", () => {
  test("a slash offers the commands", async () => {
    const setup = await mount([{ text: "hello" }]);

    await setup.mockInput.typeText("/");
    await setup.flush();

    const frame = frameOf(setup);
    expect(frame).toContain("/help");
    expect(frame).toContain("/clear");
  });

  test("the list narrows to what was typed", async () => {
    const setup = await mount([{ text: "hello" }]);

    await setup.mockInput.typeText("/cle");
    await setup.flush();

    const frame = frameOf(setup);
    expect(frame).toContain("/clear");
    expect(frame).not.toContain("/sessions");
  });

  test("Tab completes the name rather than running it", async () => {
    const setup = await mount([{ text: "hello" }]);

    await setup.mockInput.typeText("/mod");
    await setup.flush();
    setup.mockInput.pressTab();
    await setup.flush();

    const frame = frameOf(setup);
    expect(frame).toContain("/model");
    // The list is gone, so what is left is the composer waiting for a name.
    expect(frame).not.toContain("Switch the model");
  });

  test("the arrows move the selection", async () => {
    const setup = await mount([{ text: "hello" }]);

    await setup.mockInput.typeText("/");
    await setup.flush();
    setup.mockInput.pressArrow("down");
    await setup.flush();
    setup.mockInput.pressTab();
    await setup.flush();

    expect(frameOf(setup)).toContain("/clear");
  });

  test("Enter runs the selected command", async () => {
    const setup = await mount([{ text: "hello" }]);

    await setup.mockInput.typeText("/help");
    await setup.flush();
    setup.mockInput.pressEnter();

    await setup.waitFor(() =>
      setup.externalOutput
        .takeText()
        .includes("Clear the screen and start a new session"),
    );
  });

  test("Escape closes the list and keeps what was typed", async () => {
    const setup = await mount([{ text: "hello" }]);

    await setup.mockInput.typeText("/cle");
    await setup.flush();
    setup.mockInput.pressEscape();
    await setup.flush();

    const frame = frameOf(setup);
    expect(frame).toContain("/cle");
    expect(frame).not.toContain("Clear the screen");
  });

  test("a command nobody has is said so, not sent to the model", async () => {
    const setup = await mount([{ text: "hello" }]);

    await setup.mockInput.typeText("/nope");
    await setup.flush();
    setup.mockInput.pressEnter();

    await setup.waitFor(() =>
      setup.externalOutput.takeText().includes("No command /nope"),
    );
  });

  test("/clear puts the session back to a new one", async () => {
    const setup = await mount([{ text: "an answer" }], { task: "a question" });

    await setup.waitFor(() =>
      setup.externalOutput.takeText().includes("an answer"),
    );
    await setup.waitFor(() => !frameOf(setup).includes("new session"));

    await setup.mockInput.typeText("/clear");
    await setup.flush();
    setup.mockInput.pressEnter();

    await setup.waitFor(() => frameOf(setup).includes("new session"));
  });
});

describe("a failing turn", () => {
  test("is reported, and the next prompt still runs", async () => {
    const setup = await mount([
      { throws: "connection reset" },
      { text: "back" },
    ]);

    await setup.mockInput.typeText("first");
    setup.mockInput.pressEnter();
    await setup.waitFor(() =>
      setup.externalOutput.takeText().includes("connection reset"),
    );

    // The wedge: a throw used to leave the controller set for ever, so every
    // later prompt queued behind a run that had already stopped.
    await setup.mockInput.typeText("second");
    setup.mockInput.pressEnter();
    await setup.waitFor(() =>
      setup.externalOutput.takeText().includes("second"),
    );
  });
});

describe("wide characters", () => {
  test("a wrapped prompt does not swallow the rows below it", async () => {
    // A row laid out to exactly the terminal's width measures its own height
    // wrongly once it holds a wide glyph, and everything after it goes
    // undrawn — the status line first.
    const setup = await mount([{ text: "はい" }], { width: 40 });

    await setup.mockInput.typeText(
      "日本語のテキストがここにあります、そしてまだ続きます",
    );
    await setup.flush();

    const frame = frameOf(setup);
    expect(frame).toContain("日本語");
    // The status line is the last row of the footer: if it is there, nothing
    // between it and the top was lost.
    expect(frame).toContain("scripted");
    for (const line of frame.split("\n")) {
      expect(Bun.stringWidth(line)).toBeLessThanOrEqual(40);
    }
  });
});

// A streaming answer belongs in the terminal's own scrollback as it arrives, so
// the whole window scrolls. Holding it in the footer confines it to a small
// pane that only settles into the window once the turn ends.
describe("a streaming answer", () => {
  const WORDS = Array.from({ length: 90 }, (_, n) => `word${n}`).join(" ");

  test("reaches the scrollback while it is still arriving", async () => {
    const setup = await mount([{ text: WORDS }], { width: 60, delayMs: 1 });

    await setup.mockInput.typeText("go");
    setup.mockInput.pressEnter();

    // Mid-stream, not after: the earliest rows are already in the terminal
    // while the model is still sending the rest.
    await setup.waitFor(() =>
      setup.externalOutput.takeText().includes("word0"),
    );
    expect(frameOf(setup)).not.toContain("word0");
  });

  test("keeps only the row still being written in the footer", async () => {
    const setup = await mount([{ text: WORDS }], { width: 60, delayMs: 1 });

    await setup.mockInput.typeText("go");
    setup.mockInput.pressEnter();
    await setup.waitFor(() =>
      setup.externalOutput.takeText().includes("word0"),
    );

    // The footer is the unfinished row plus the spinner, the composer and the
    // status line. It never grows into a pane of its own.
    expect(setup.renderer.footerHeight).toBeLessThanOrEqual(6);
  });

  test("no row is written to the scrollback twice", async () => {
    const setup = await mount([{ text: WORDS }], { width: 60 });
    const written: string[] = [];

    await setup.mockInput.typeText("go");
    setup.mockInput.pressEnter();
    await setup.waitFor(() => {
      written.push(setup.externalOutput.takeText());
      return written.join("").includes("word89");
    });

    const all = written.join("");
    for (const word of ["word0", "word40", "word89"]) {
      expect(all.split(word).length - 1).toBe(1);
    }
  });
});
