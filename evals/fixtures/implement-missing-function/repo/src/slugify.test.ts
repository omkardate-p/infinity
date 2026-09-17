import { expect, test } from "bun:test";
import { slugify } from "./slugify.ts";

test("lowercases and hyphenates", () => {
  expect(slugify("Hello World")).toBe("hello-world");
});

test("drops punctuation", () => {
  expect(slugify("What's New?")).toBe("whats-new");
});

test("collapses runs of separators", () => {
  expect(slugify("a   b --  c")).toBe("a-b-c");
});

test("trims leading and trailing separators", () => {
  expect(slugify("  spaced  ")).toBe("spaced");
});
