import { expect, test } from "bun:test";
import { total } from "./total.ts";

test("sums the amounts", () => {
  expect(total([1, 2, 3])).toBe(6);
});

test("an empty list totals zero", () => {
  expect(total([])).toBe(0);
});
