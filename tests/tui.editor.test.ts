/**
 * The composer's buffer. Multiline cursor movement is the part of a hand-built
 * terminal input that silently goes wrong, so it is tested here rather than by
 * pressing keys and looking.
 */

import { describe, expect, test } from "bun:test";
import {
  backspace,
  deleteForward,
  down,
  emptyBuffer,
  insert,
  left,
  lineEnd,
  lineStart,
  position,
  right,
  up,
  type Buffer,
} from "../tui/editor.ts";

/** "ab|c" means the cursor sits between b and c. */
function parse(marked: string): Buffer {
  const cursor = marked.indexOf("|");
  return { text: marked.replace("|", ""), cursor };
}

function show(buffer: Buffer): string {
  return (
    buffer.text.slice(0, buffer.cursor) + "|" + buffer.text.slice(buffer.cursor)
  );
}

describe("typing", () => {
  test("inserts at the cursor", () => {
    expect(show(insert(parse("ac|"), "b"))).toBe("acb|");
    expect(show(insert(parse("a|c"), "b"))).toBe("ab|c");
  });

  test("a newline is just another character", () => {
    expect(show(insert(parse("a|b"), "\n"))).toBe("a\n|b");
  });

  test("backspace at the start does nothing", () => {
    expect(show(backspace(parse("|abc")))).toBe("|abc");
  });

  test("delete at the end does nothing", () => {
    expect(show(deleteForward(parse("abc|")))).toBe("abc|");
  });

  test("backspace joins two lines", () => {
    expect(show(backspace(parse("one\n|two")))).toBe("one|two");
  });
});

describe("horizontal movement", () => {
  test("stops at both ends", () => {
    expect(show(left(parse("|abc")))).toBe("|abc");
    expect(show(right(parse("abc|")))).toBe("abc|");
  });

  test("crosses a line boundary one character at a time", () => {
    expect(show(right(parse("a|\nb")))).toBe("a\n|b");
    expect(show(left(parse("a\n|b")))).toBe("a|\nb");
  });

  test("home and end act on the current line, not the whole buffer", () => {
    expect(show(lineStart(parse("one\ntw|o")))).toBe("one\n|two");
    expect(show(lineEnd(parse("on|e\ntwo")))).toBe("one|\ntwo");
  });
});

describe("vertical movement", () => {
  test("keeps the column", () => {
    expect(show(up(parse("abcd\nef|gh")))).toBe("ab|cd\nefgh");
    expect(show(down(parse("ab|cd\nefgh")))).toBe("abcd\nef|gh");
  });

  test("clamps to the end of a shorter line", () => {
    expect(show(up(parse("ab\ncdef|gh")))).toBe("ab|\ncdefgh");
    expect(show(down(parse("cdef|gh\nab")))).toBe("cdefgh\nab|");
  });

  test("does nothing on the first or last line", () => {
    expect(show(up(parse("a|bc")))).toBe("a|bc");
    expect(show(down(parse("a|bc")))).toBe("a|bc");
  });

  test("up then down returns to the same line", () => {
    const start = parse("one\ntw|o\nthree");
    expect(show(down(up(start)))).toBe(show(start));
  });
});

describe("position", () => {
  test("reports line and column for drawing the caret", () => {
    expect(position(emptyBuffer())).toEqual({ line: 0, column: 0 });
    expect(position(parse("one\ntw|o"))).toEqual({ line: 1, column: 2 });
    expect(position(parse("one\n|two"))).toEqual({ line: 1, column: 0 });
  });
});
