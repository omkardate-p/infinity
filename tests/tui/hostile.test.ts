/**
 * Input nobody types on purpose.
 *
 * Every defect this file is aimed at reached a screen or a model once: a width
 * of zero from a terminal mid-resize, a paste carrying half a surrogate pair or
 * a CRLF, a cursor driven past both ends, a glyph wider than the row it has to
 * fit in. The properties here hold for any input, so they are asserted against
 * generated ones rather than a handful chosen to pass.
 */

import { describe, expect, test } from "bun:test";
import type { TranscriptItem } from "../../src/domain/messages.ts";
import {
  type Buffer,
  backspace,
  deleteForward,
  down,
  emptyBuffer,
  insert,
  left,
  lineEnd,
  lineStart,
  right,
  up,
} from "../../src/tui/input/editor.ts";
import {
  cells,
  fitLine,
  graphemes,
  padLine,
  shortenPath,
} from "../../src/tui/rendering/format.ts";
import {
  composerLines,
  composerRows,
  footerPlan,
  itemLines,
  lineText,
  lineWidth,
  promptLines,
  wrap,
} from "../../src/tui/rendering/lines.ts";

const ESC = String.fromCharCode(0x1b);
const NUL = String.fromCharCode(0x00);
const COMBINING_ACUTE = String.fromCharCode(0x0301);
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);

/** Pieces chosen because each one breaks a different assumption. */
const PIECES = [
  "a",
  " ",
  "\t",
  "\n",
  "\r\n",
  "\u65e5",
  "\u{1f468}\u200d\u{1f469}\u200d\u{1f467}\u200d\u{1f466}",
  "\u{1f1ef}\u{1f1f5}",
  `e${COMBINING_ACUTE}`,
  COMBINING_ACUTE,
  "\u2192",
  ZERO_WIDTH_SPACE,
  "x".repeat(40),
  `${ESC}[31m`,
  NUL,
  "\u00e9",
  "\u{1d518}",
];

function mulberry(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate(random: () => number, pieces = 12): string {
  let text = "";
  for (let n = 0; n < pieces; n += 1) {
    text += PIECES[Math.floor(random() * PIECES.length)]!;
  }
  return text;
}

describe("a width the terminal can actually report", () => {
  // A terminal mid-resize, a detached tmux pane and COLUMNS=0 all deliver these.
  const widths = [-5, -1, 0, 1, 2, 3];

  test("fitLine never returns more than it was asked for", () => {
    for (const width of widths) {
      for (const text of ["", "abc", "日本語", "👨‍👩‍👧‍👦"]) {
        const fitted = fitLine(text, width);
        expect(cells(fitted)).toBeLessThanOrEqual(Math.max(0, width));
      }
    }
  });

  test("fitLine with a negative width returns nothing, not the tail", () => {
    // slice(0, -2) counts from the end, which is how this once returned
    // "src/cli." for a width of -2.
    expect(fitLine("src/cli.ts", -2)).toBe("");
  });

  test("padLine never overshoots", () => {
    for (const width of widths) {
      expect(cells(padLine("日本語", width))).toBeLessThanOrEqual(
        Math.max(0, width),
      );
    }
  });

  test("wrap terminates and makes progress at any width", () => {
    for (const width of widths) {
      const rows = wrap("日本語のテキスト and some words", width);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.join("")).not.toBe("");
    }
  });

  test("itemLines survives a one-column terminal", () => {
    const item: TranscriptItem = {
      key: 1,
      kind: "assistant",
      text: "日本語 x",
    };
    for (const width of [1, 2, 3]) {
      const lines = itemLines(item, width);
      for (const line of lines) expect(lineText(line)).not.toContain("\n");
    }
  });
});

describe("layout holds for generated input", () => {
  const widths = [8, 13, 20, 41, 80];

  test("no produced line is wider than its width", () => {
    const random = mulberry(7);
    for (let round = 0; round < 300; round += 1) {
      const text = generate(random);
      const width = widths[Math.floor(random() * widths.length)]!;
      const items: TranscriptItem[] = [
        { key: 1, kind: "assistant", text },
        { key: 2, kind: "user", text },
        { key: 3, kind: "error", message: text },
        {
          key: 4,
          kind: "tool",
          id: "t",
          name: text.slice(0, 8),
          args: { command: text },
          status: "running",
          content: text,
        },
      ];
      for (const item of items) {
        for (const line of itemLines(item, width)) {
          if (lineWidth(line) > width) {
            throw new Error(
              `${item.kind} at ${width}: ${lineWidth(line)} cells from ${JSON.stringify(text)}`,
            );
          }
          expect(lineText(line)).not.toContain("\n");
        }
      }
    }
  });

  test("a queued prompt band covers exactly its width", () => {
    const random = mulberry(11);
    for (let round = 0; round < 200; round += 1) {
      const width = widths[Math.floor(random() * widths.length)]!;
      for (const line of promptLines(generate(random), width)) {
        expect(lineWidth(line)).toBe(width);
      }
    }
  });

  test("the composer never draws past its width, at any cursor", () => {
    const random = mulberry(13);
    for (let round = 0; round < 200; round += 1) {
      const text = generate(random, 8);
      const width = widths[Math.floor(random() * widths.length)]!;
      const cursor = Math.floor(random() * (text.length + 1));
      for (const line of composerLines({ text, cursor }, width, cursor, 6)) {
        expect(lineWidth(line)).toBeLessThanOrEqual(width);
      }
    }
  });

  test("composerRows agrees with the rows composerLines produces", () => {
    const random = mulberry(17);
    for (let round = 0; round < 200; round += 1) {
      const text = generate(random, 6);
      const width = widths[Math.floor(random() * widths.length)]!;
      const buffer = { text, cursor: text.length };
      const rows = composerRows(buffer, width);
      expect(
        composerLines(buffer, width, buffer.cursor, Number.POSITIVE_INFINITY)
          .length,
      ).toBe(rows);
    }
  });
});

describe("the footer plan cannot be argued into taking the screen", () => {
  test("whatever it is asked for, including nonsense", () => {
    const heights = [0, 1, 2, 3, 5, 10, 24, 200];
    const asks = [0, 1, 7, 99, 10_000];
    for (const height of heights) {
      for (const ask of asks) {
        const plan = footerPlan({
          height,
          liveRows: ask,
          detailRows: ask,
          queuedRows: ask,
          composerRows: ask,
          spinner: true,
        });
        expect(plan.rows).toBeGreaterThanOrEqual(1);
        expect(plan.rows).toBeLessThanOrEqual(Math.max(1, height - 1));
        expect(plan.composer).toBeGreaterThanOrEqual(1);
        for (const part of [
          plan.live,
          plan.detail,
          plan.queued,
          plan.spinner,
        ]) {
          expect(part).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe("the editor survives what a paste can carry", () => {
  const ops = [
    backspace,
    deleteForward,
    left,
    right,
    up,
    down,
    lineStart,
    lineEnd,
  ];

  test("the cursor never lands inside a grapheme", () => {
    const random = mulberry(23);
    for (let round = 0; round < 300; round += 1) {
      let buffer: Buffer = insert(emptyBuffer(), generate(random, 6));
      for (let step = 0; step < 12; step += 1) {
        buffer = ops[Math.floor(random() * ops.length)]!(buffer);
        expect(buffer.cursor).toBeGreaterThanOrEqual(0);
        expect(buffer.cursor).toBeLessThanOrEqual(buffer.text.length);
        const boundaries = new Set(graphemes(buffer.text).map((g) => g.index));
        boundaries.add(buffer.text.length);
        expect(boundaries.has(buffer.cursor)).toBe(true);
      }
    }
  });

  test("backspace removes a whole cluster, not a code unit", () => {
    const family = "👨‍👩‍👧‍👦";
    const buffer = insert(emptyBuffer(), `a${family}`);
    expect(backspace(buffer).text).toBe("a");
  });

  test("nothing produces an unpaired surrogate", () => {
    const random = mulberry(29);
    for (let round = 0; round < 200; round += 1) {
      let buffer: Buffer = insert(emptyBuffer(), generate(random, 6));
      for (let step = 0; step < 10; step += 1) {
        buffer = ops[Math.floor(random() * ops.length)]!(buffer);
      }
      for (const unit of buffer.text) {
        const code = unit.codePointAt(0)!;
        // A well-formed string never yields a bare surrogate when iterated.
        expect(code >= 0xd800 && code <= 0xdfff).toBe(false);
      }
    }
  });

  test("a lone high surrogate arriving as a paste does not throw", () => {
    const buffer = insert(emptyBuffer(), "a\ud83d");
    expect(() => backspace(buffer)).not.toThrow();
    expect(() => cells(buffer.text)).not.toThrow();
    expect(() => fitLine(buffer.text, 3)).not.toThrow();
  });
});

describe("what a paste puts in the prompt", () => {
  test("a CRLF paste does not leave a carriage return in the text", () => {
    // The buffer is sent to the model verbatim; a \r reaches the provider.
    const pasted = insert(emptyBuffer(), "one\r\ntwo");
    expect(pasted.text).not.toContain("\r");
  });
});

describe("shortenPath", () => {
  test("never exceeds the width it is given", () => {
    const random = mulberry(31);
    for (let round = 0; round < 200; round += 1) {
      const segments = Array.from({ length: 5 }, () => generate(random, 3));
      const max = 4 + Math.floor(random() * 40);
      expect(
        cells(shortenPath(`/${segments.join("/")}`, max)),
      ).toBeLessThanOrEqual(max);
    }
  });
});
