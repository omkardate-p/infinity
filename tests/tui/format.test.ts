/**
 * Display formatting: what a footer line has to do to the cells it covers, and
 * how wide a string actually is once the terminal draws it.
 */

import { describe, expect, test } from "bun:test";
import { opaque } from "../../src/tui/rendering/format.ts";

describe("opaque", () => {
  test("swaps the spaces a footer line cannot rely on", () => {
    // An ASCII space will not overwrite a glyph already in the cell, so the
    // footer would show whatever the previous frame left there.
    expect(opaque("a b  c")).toBe("a b  c");
    expect(opaque("abc")).toBe("abc");
  });
});
