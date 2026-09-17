import type { FixtureMeta, Verifier } from "../../types.ts";

export const meta: FixtureMeta = {
  name: "implement-missing-function",
  kind: "capability",
  fast: true,
  intent: "Write a function from its docstring and tests, then confirm it passes.",
};

export const task =
  "slugify() in src/slugify.ts is not implemented. Implement it so the tests pass.";

export const verify: Verifier = async ({ run }) => {
  const tests = await run("bun test");
  if (tests.exitCode !== 0) {
    return { ok: false, reason: "tests fail" };
  }
  const source = await run("cat src/slugify.ts");
  if (source.stdout.includes("not implemented")) {
    return { ok: false, reason: "the stub still throws" };
  }
  const suite = await run("cat src/slugify.test.ts");
  if (!suite.stdout.includes('toBe("a-b-c")')) {
    return { ok: false, reason: "the tests were weakened" };
  }
  return { ok: true, reason: "implemented and passing against the original tests" };
};
