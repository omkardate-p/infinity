import { expect, test } from "bun:test";
import { findConflict } from "./schedule.ts";

test("finds an overlapping booking", () => {
  expect(findConflict([{ start: 10, end: 20 }], { start: 15, end: 25 })).toEqual({ start: 10, end: 20 });
});

test("ignores a booking that ends before the request starts", () => {
  expect(findConflict([{ start: 1, end: 5 }], { start: 9, end: 12 })).toBeUndefined();
});

test("treats touching ends as a conflict, because ends are inclusive", () => {
  expect(findConflict([{ start: 10, end: 20 }], { start: 20, end: 30 })).toEqual({ start: 10, end: 20 });
});
