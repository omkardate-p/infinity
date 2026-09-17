import { expect, test } from "bun:test";
import { parseTags } from "./tags.ts";

test("trims the space after a comma", () => {
  expect(parseTags("red, green, blue")).toEqual(["red", "green", "blue"]);
});

test("keeps spaces inside a multi-word tag", () => {
  expect(parseTags("dark mode,light mode")).toEqual(["dark mode", "light mode"]);
});
