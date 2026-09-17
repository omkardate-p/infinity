import type { FixtureMeta, Verifier } from "../../types.ts";

export const meta: FixtureMeta = {
  name: "fix-failing-test",
  kind: "capability",
  fast: true,
  intent: "Run the suite, read the failure, fix the one wrong operator.",
};

export const task = "The test suite is failing. Run the tests, find the bug and fix it.";

export const verify: Verifier = async ({ run }) => {
  const tests = await run("bun test");
  if (tests.exitCode !== 0) {
    return { ok: false, reason: `tests still fail: ${lastLine(tests.stderr || tests.stdout)}` };
  }
  // The suite must still be the one we shipped, not a suite the agent weakened.
  const suite = await run("cat src/total.test.ts");
  if (!suite.stdout.includes("toBe(6)")) {
    return { ok: false, reason: "the test was changed instead of the code" };
  }
  return { ok: true, reason: "tests pass with the original assertions" };
};

function lastLine(output: string): string {
  return output.trim().split("\n").at(-1) ?? "";
}
