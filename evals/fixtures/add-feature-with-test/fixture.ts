import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { failureLine } from "../../checks.ts";
import type { FixtureMeta, Verifier } from "../../types.ts";

export const meta: FixtureMeta = {
  name: "add-feature-with-test",
  kind: "capability",
  fast: false,
  intent: "Add a function and a test that genuinely exercises it.",
};

export const task =
  "Add a clamp(value, min, max) function to src/numbers.ts that returns value " +
  "limited to the range, and add tests for it. Run the test suite when you are done.";

const BROKEN = `export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function clamp(value: number, min: number, max: number): number {
  return 0;
}
`;

export const verify: Verifier = async ({ repo, run }) => {
  const tests = await run("bun test");
  if (tests.exitCode !== 0)
    return {
      ok: false,
      reason: `the suite does not pass: ${failureLine(tests)}`,
    };

  // Behaviour check, independent of whatever tests the agent wrote.
  await writeFile(
    join(repo, "verify-probe.test.ts"),
    `import { expect, test } from "bun:test";
import { clamp } from "./src/numbers.ts";

test("clamps in both directions", () => {
  expect(clamp(5, 0, 10)).toBe(5);
  expect(clamp(-1, 0, 10)).toBe(0);
  expect(clamp(99, 0, 10)).toBe(10);
});
`,
    "utf8",
  );
  const probe = await run("bun test verify-probe.test.ts");
  if (probe.exitCode !== 0)
    return { ok: false, reason: "clamp does not behave correctly" };

  // A test that passes against a broken clamp is not a test. Break it and the
  // agent's own suite must notice.
  const original = await readFile(join(repo, "src/numbers.ts"), "utf8");
  await writeFile(join(repo, "src/numbers.ts"), BROKEN, "utf8");
  const mutated = await run("bun test src");
  await writeFile(join(repo, "src/numbers.ts"), original, "utf8");

  if (mutated.exitCode === 0) {
    return {
      ok: false,
      reason: "the added test passes even when clamp always returns 0",
    };
  }

  return {
    ok: true,
    reason:
      "clamp implemented with a test that actually catches a broken clamp",
  };
};
