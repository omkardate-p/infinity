import { expect, test } from "bun:test";
import { fetchUser } from "./api.ts";
import { profileLine } from "./profile.ts";
import { greet } from "./greeting.ts";

test("looks a user up by id", () => {
  expect(fetchUser("1")?.name).toBe("Ada");
});

test("formats a profile line", () => {
  expect(profileLine("2")).toBe("Grace (2)");
});

test("greets a known user", () => {
  expect(greet("1")).toBe("Hello, Ada!");
});
