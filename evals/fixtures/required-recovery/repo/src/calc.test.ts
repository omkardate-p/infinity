import { expect, test } from "bun:test";
import { percent } from "./calc.ts";

test("expresses a part as a percentage", () => {
  expect(percent(1, 4)).toBe(25);
  expect(percent(2, 5)).toBe(40);
