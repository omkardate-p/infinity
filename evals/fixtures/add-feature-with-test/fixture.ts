import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
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

export const verify: Verifier = async ({ repo, run }) => {
  const tests = await run("bun test");
  if (tests.exitCode !== 0) return { ok: false, reason: "the suite does not pass" };

  const source = await readFile(join(repo, "src/numbers.ts"), "utf8");
  if (!/export\s+function\s+clamp/.test(source)) {
    return { ok: false, reason: "clamp is not exported from src/numbers.ts" };
  }

  const mentionsClamp = await run("grep -rln 'clamp' --include='*.test.ts' src || true");
  if (!mentionsClamp.stdout.trim()) {
    return { ok: false, reason: "no test file references clamp" };
  }

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
  if (probe.exitCode !== 0) return { ok: false, reason: "clamp does not behave correctly" };

  // A test that passes against a broken clamp is not a test. Break it and the
  // agent's own suite must notice.
  const broken = source.replace(
    /export\s+function\s+clamp\s*\(([^)]*)\)\s*(:\s*number\s*)?\{[\s\S]*?\n\}/,
    (match) => `${match.split("{")[0]}{\n  return 0;\n}`,
  );
  if (broken === source) {
    return { ok: false, reason: "could not isolate clamp to check the test is meaningful" };
  }
  await writeFile(join(repo, "verify-probe.test.ts"), "", "utf8");
  await writeFile(join(repo, "src/numbers.ts"), broken, "utf8");
  const mutated = await run("bun test src");
  await writeFile(join(repo, "src/numbers.ts"), source, "utf8");

  if (mutated.exitCode === 0) {
    return { ok: false, reason: "the added test passes even when clamp always returns 0" };
  }

  return { ok: true, reason: "clamp implemented with a test that actually catches a broken clamp" };
};
