import { expect, test } from "bun:test";
import { round2 } from "./numbers.ts";

test("rounds to two decimal places", () => {
  expect(round2(1.2345)).toBe(1.23);
  expect(round2(2.5)).toBe(2.5);
  expect(round2(2)).toBe(2);
});
