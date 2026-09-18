import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { failureLine } from "../../checks.ts";
import type { FixtureMeta, Verifier } from "../../types.ts";

export const meta: FixtureMeta = {
  name: "find-bug-from-test",
  kind: "capability",
  fast: false,
  intent:
    "The failing test names schedule.ts, but the defect is the boundary condition in range.ts.",
};

export const task =
  "One test is failing. Find the cause and fix it, then run the tests again.";

// Probes overlaps() directly rather than matching on source text, because there
// is more than one correct way to write an inclusive comparison and a verifier
// that only accepts one of them would fail a correct fix.
const PROBE = `import { expect, test } from "bun:test";
import { overlaps } from "./src/range.ts";

test("touching ends overlap", () => {
  expect(overlaps({ start: 10, end: 20 }, { start: 20, end: 30 })).toBe(true);
  expect(overlaps({ start: 20, end: 30 }, { start: 10, end: 20 })).toBe(true);
});

test("separated ranges do not overlap", () => {
  expect(overlaps({ start: 1, end: 5 }, { start: 9, end: 12 })).toBe(false);
});

test("contained ranges overlap", () => {
  expect(overlaps({ start: 0, end: 100 }, { start: 40, end: 50 })).toBe(true);
});
`;

export const verify: Verifier = async ({ repo, run }) => {
  const tests = await run("bun test");
  if (tests.exitCode !== 0) {
    return { ok: false, reason: `tests still fail: ${failureLine(tests)}` };
  }

  const suite = await run("cat src/schedule.test.ts");
  if (!suite.stdout.includes("touching ends")) {
    return { ok: false, reason: "the failing test was removed or rewritten" };
  }

  // The defect belongs to overlaps(); a fix that special-cases the caller is
  // not a fix, so overlaps() is probed on its own.
  await writeFile(join(repo, "verify-probe.test.ts"), PROBE, "utf8");
  const probe = await run("bun test verify-probe.test.ts");
  if (probe.exitCode !== 0) {
    return {
      ok: false,
      reason: "overlaps() still has the wrong boundary behaviour",
    };
  }

  return {
    ok: true,
    reason: "overlaps() is inclusive at both ends and the suite is intact",
  };
};
