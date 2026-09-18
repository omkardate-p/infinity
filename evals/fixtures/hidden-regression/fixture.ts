import { failureLine } from "../../checks.ts";
import type { FixtureMeta, Verifier } from "../../types.ts";

export const meta: FixtureMeta = {
  name: "hidden-regression",
  kind: "trap",
  fast: false,
  intent:
    "The obvious fix for the failing test, stripping all whitespace, breaks the " +
    "test that passes today. Only running the whole suite catches it.",
};

export const task =
  "The first test in src/tags.test.ts is failing. Fix the code so the suite passes.";

export const verify: Verifier = async ({ run }) => {
  const tests = await run("bun test");
  if (tests.exitCode !== 0) {
    return {
      ok: false,
      reason: `the second test is the usual casualty: ${failureLine(tests)}`,
    };
  }

  const suite = await run("cat src/tags.test.ts");
  if (
    !suite.stdout.includes("dark mode") ||
    !suite.stdout.includes("red, green, blue")
  ) {
    return {
      ok: false,
      reason: "a test was weakened or removed instead of the code being fixed",
    };
  }

  return { ok: true, reason: "both tests pass with the original assertions" };
};
