import { expect, test } from "bun:test";
import { round2 } from "./numbers.ts";

test("rounds to two decimal places", () => {
  expect(round2(1.005)).toBe(1.01);
  expect(round2(2)).toBe(2);
});
