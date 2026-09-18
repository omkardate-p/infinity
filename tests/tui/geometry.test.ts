/**
 * The geometry contract, which is what every rendering defect in this TUI has
 * violated: a line is never wider than the width it was given, a snapshot
 * occupies exactly the rows it declares, and the footer never asks for more
 * rows than the terminal has.
 *
 * Width here means terminal cells. A code unit, a code point and a cell are
 * three different counts, so every assertion measures with the same function
 * the layout does, and the corpus is deliberately not ASCII: the defects that
 * shipped were invisible to a test that only typed letters.
 */

import { describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { createElement } from "react";
import type { TranscriptItem } from "../../src/domain/messages.ts";
import { cells } from "../../src/tui/rendering/format.ts";
import {
  composerLines,
  composerRows,
  footerPlan,
  itemLines,
  type Line,
  lineText,
  lineWidth,
  type MenuEntry,
  menuLines,
  menuRows,
  promptLines,
  styledText,
} from "../../src/tui/rendering/lines.ts";

// One entry per way a character has fooled a length-based layout.
const CORPUS: Record<string, string> = {
  ascii: "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo",
  cjk: "日本語のテキストがここにあります、そしてまだ続いていきます",
  emoji: "👨‍👩‍👧‍👦 family 👩‍💻 coder 🇯🇵 flag ☃️ snow ".repeat(3),
  combining: "é".repeat(60),
  paragraphs: "First paragraph.\n\nSecond paragraph runs on a while.\nThird.",
  tabs: "col\tone\tcol\ttwo\tcol\tthree",
  oneLongWord: "x".repeat(300),
  mixed: "path/to/日本語/file.ts — 変更 3 行 👍 done",
};

const WIDTHS = [12, 20, 34, 40, 61, 80, 121];

function items(text: string): TranscriptItem[] {
  return [
    { key: 1, kind: "assistant", text },
    { key: 2, kind: "user", text },
    { key: 3, kind: "error", message: text },
    { key: 4, kind: "banner", model: text, workspace: text, version: text },
    {
      key: 5,
      kind: "tool",
      id: "t1",
      name: text.slice(0, 12),
      args: { command: text },
      status: "running",
      content: text,
    },
    {
      key: 6,
      kind: "tool",
      id: "t2",
      name: text.slice(0, 12),
      args: { command: text },
      status: "ok",
      content: text,
    },
    { key: 7, kind: "notice", reason: "aborted", turns: 2 },
    { key: 8, kind: "elapsed", ms: 61_000, at: Date.now() },
  ];
}

describe("no line is wider than the width it was given", () => {
  for (const [name, text] of Object.entries(CORPUS)) {
    test(name, () => {
      for (const width of WIDTHS) {
        for (const item of items(text)) {
          for (const line of itemLines(item, width)) {
            if (lineWidth(line) > width) {
              throw new Error(
                `${item.kind} at width ${width} drew ${lineWidth(line)} cells: ${JSON.stringify(lineText(line))}`,
              );
            }
          }
        }
      }
    });
  }
});

describe("no line carries a newline of its own", () => {
  // A chunk containing a newline renders as a row the caller never counted, so
  // the snapshot's declared height is short and its last rows are lost.
  for (const [name, text] of Object.entries(CORPUS)) {
    test(name, () => {
      for (const width of WIDTHS) {
        for (const item of items(text)) {
          for (const line of itemLines(item, width)) {
            expect(lineText(line)).not.toContain("\n");
          }
        }
      }
    });
  }
});

describe("the composer", () => {
  const widths = [24, 40, 80];

  test("every row fits, whatever the cursor sits on", () => {
    for (const width of widths) {
      for (const text of Object.values(CORPUS)) {
        for (let cursor = 0; cursor <= text.length; cursor += 7) {
          const lines = composerLines({ text, cursor }, width, cursor, 40);
          for (const line of lines) {
            expect(lineWidth(line)).toBeLessThanOrEqual(width);
          }
        }
      }
    }
  });

  test("the cursor is always on a row that is shown", () => {
    const text = "y".repeat(500);
    for (const width of widths) {
      for (const cursor of [0, 1, width - 3, width - 2, 250, 499, 500]) {
        const lines = composerLines({ text, cursor }, width, cursor, 3);
        expect(lines.length).toBeLessThanOrEqual(3);
        const drawn = lines.filter((line) =>
          line.some((chunk) => chunk.inverse),
        );
        expect(drawn).toHaveLength(1);
      }
    }
  });

  test("text longer than the terminal wraps instead of being cut off", () => {
    const text = "z".repeat(200);
    const lines = composerLines({ text, cursor: 200 }, 40, 200, 40);
    expect(lines.length).toBeGreaterThan(1);
    expect(composerRows({ text, cursor: 200 }, 40)).toBe(lines.length);
  });

  test("a hidden cursor still produces rows of the full width", () => {
    for (const width of widths) {
      for (const line of composerLines({ text: "", cursor: 0 }, width, -1, 4)) {
        expect(lineWidth(line)).toBe(width);
      }
    }
  });
});

// Names and summaries are ordinary text, so the menu is measured against the
// same corpus everything else is.
function menu(text: string): MenuEntry[] {
  return Object.keys(CORPUS).map((name, index) => ({
    name: `/${name}`,
    description: text,
    match: index % 2 === 0 ? { start: 1, end: 3 } : undefined,
  }));
}

describe("the command menu", () => {
  for (const [name, text] of Object.entries(CORPUS)) {
    test(name, () => {
      const entries = menu(text);
      for (const width of WIDTHS) {
        for (let selected = 0; selected < entries.length; selected++) {
          for (const maxRows of [1, 3, 10, Number.POSITIVE_INFINITY]) {
            const lines = menuLines(entries, selected, width, maxRows);
            expect(lines.length).toBeLessThanOrEqual(maxRows);
            for (const line of lines) {
              expect(lineWidth(line)).toBeLessThanOrEqual(width);
              expect(lineText(line)).not.toContain("\n");
            }
          }
        }
      }
    });
  }

  test("the selected command is on screen however short the list is cut", () => {
    const entries = menu("a summary that runs on for a while and then wraps");
    for (const width of [24, 40, 80]) {
      for (let selected = 0; selected < entries.length; selected++) {
        const shown = menuLines(entries, selected, width, 3)
          .map(lineText)
          .join("\n");
        expect(shown).toContain(entries[selected]!.name);
      }
    }
  });

  test("what it asks the footer for is what it draws", () => {
    const entries = menu("short");
    for (const width of WIDTHS) {
      expect(
        menuLines(entries, 0, width, Number.POSITIVE_INFINITY).length,
      ).toBe(menuRows(entries, width));
    }
  });

  test("nothing at all to show is no rows at all", () => {
    expect(menuLines([], 0, 80, 10)).toEqual([]);
    expect(menuRows([], 80)).toBe(0);
  });
});

describe("the footer is never taller than the terminal", () => {
  test("whatever every part asks for", () => {
    for (let height = 3; height <= 60; height += 1) {
      for (const detailRows of [undefined, 0, 3, 40, 400]) {
        for (const composer of [1, 2, 30, 300]) {
          const plan = footerPlan({
            height,
            liveRows: 6,
            detailRows,
            menuRows: 14,
            queuedRows: 25,
            composerRows: composer,
            spinner: true,
          });

          expect(plan.rows).toBeLessThanOrEqual(Math.max(1, height - 1));
          // The composer and the status line are the two rows that must
          // survive: without them there is no way to type or to see the state.
          expect(plan.composer).toBeGreaterThanOrEqual(1);
          expect(plan.detail).toBeLessThanOrEqual(detailRows ?? 0);
        }
      }
    }
  });

  test("a menu of any length stops at ten rows", () => {
    const plan = footerPlan({
      height: 60,
      liveRows: 0,
      detailRows: undefined,
      menuRows: 400,
      queuedRows: 0,
      composerRows: 1,
      spinner: false,
    });

    expect(plan.menu).toBe(10);
  });

  test("the menu is served before the transcript's own rows", () => {
    const plan = footerPlan({
      height: 13,
      liveRows: 20,
      detailRows: undefined,
      menuRows: 8,
      queuedRows: 20,
      composerRows: 1,
      spinner: false,
    });

    expect(plan.menu).toBe(8);
    expect(plan.live).toBe(0);
    expect(plan.queued).toBe(0);
    expect(plan.composer).toBeGreaterThanOrEqual(1);
    expect(plan.rows).toBeLessThanOrEqual(12);
  });

  test("an approval keeps its question on screen before anything else", () => {
    const plan = footerPlan({
      height: 24,
      liveRows: 6,
      detailRows: 60,
      menuRows: 0,
      queuedRows: 12,
      composerRows: 1,
      spinner: false,
    });

    expect(plan.detail).toBeGreaterThan(0);
    expect(plan.live).toBe(0);
    expect(plan.queued).toBe(0);
    expect(plan.rows).toBeLessThanOrEqual(23);
  });
});

// The renderer, not the arithmetic. A committed snapshot declares its height
// from the line count, so the two have to agree about what a row is — which is
// exactly what a wrapped line, a wide glyph or an embedded newline breaks.
describe("the renderer draws the rows the layout counted", () => {
  const SENTINEL = "ZZZSENTINELZZZ";

  async function rowsUsed(lines: Line[], width: number): Promise<number> {
    const setup = await testRender(
      createElement(
        "box",
        { flexDirection: "column" },
        createElement("text", { content: styledText(lines) }),
        createElement("text", { content: SENTINEL }),
      ),
      { width, height: 60 },
    );
    setup.renderer.start();
    await setup.flush();
    // captureSpans, not captureCharFrame: the char frame slices a flat array of
    // cells into rows, so a row holding a wide glyph comes back short and every
    // row after it is misaligned.
    const rows = setup
      .captureSpans()
      .lines.map((line) => line.spans.map((span) => span.text).join(""));
    const at = rows.findIndex((row) => row.includes(SENTINEL));
    expect(at).toBeGreaterThanOrEqual(0);
    return at;
  }

  for (const [name, text] of Object.entries(CORPUS)) {
    test(name, async () => {
      for (const width of [40, 80]) {
        for (const item of items(text)) {
          const lines = itemLines(item, width - 1);
          expect(await rowsUsed(lines, width)).toBe(lines.length);
        }
      }
    });
  }

  test("a queued prompt occupies the rows the footer reserved for it", async () => {
    for (const width of [40, 80]) {
      for (const text of Object.values(CORPUS)) {
        const lines = promptLines(text, width - 1);
        expect(await rowsUsed(lines, width)).toBe(lines.length);
      }
    }
  });

  test("the menu occupies the rows the footer reserved for it", async () => {
    for (const width of [40, 80]) {
      for (const text of Object.values(CORPUS)) {
        const lines = menuLines(menu(text), 2, width - 1, 6);
        expect(await rowsUsed(lines, width)).toBe(lines.length);
      }
    }
  });

  test("the composer occupies the rows the footer reserved for it", async () => {
    for (const width of [40, 80]) {
      for (const text of Object.values(CORPUS)) {
        const buffer = { text, cursor: text.length };
        const lines = composerLines(buffer, width - 1, text.length, 8);
        expect(await rowsUsed(lines, width)).toBe(lines.length);
      }
    }
  });
});

describe("cells", () => {
  test("counts what the terminal draws, not what the string holds", () => {
    expect(cells("日本語")).toBe(6);
    expect(cells("👨‍👩‍👧‍👦")).toBe(2);
    expect(cells("é")).toBe(1);
    expect(cells("a\tb")).toBe(6);
  });
});
