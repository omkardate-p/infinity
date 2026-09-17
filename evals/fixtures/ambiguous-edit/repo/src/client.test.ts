import { expect, test } from "bun:test";
import { connect, poll } from "./client.ts";

test("poll keeps its own timeout", () => {
  expect(poll("example.com")).toBe("poll example.com timeout=1000");
});
