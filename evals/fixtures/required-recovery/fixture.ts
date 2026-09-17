import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FixtureMeta, Verifier } from "../../types.ts";

export const meta: FixtureMeta = {
  name: "required-recovery",
  kind: "trap",
  fast: false,
  intent:
    "Two failures stacked: the suite will not parse, and once it does an assertion " +
    "fails. The agent has to run, read, fix, and run again.",
};

export const task = "The test suite is failing. Get it passing.";

const PROBE = `import { expect, test } from "bun:test";
import { percent } from "./src/calc.ts";

test("percent returns a percentage", () => {
  expect(percent(1, 4)).toBe(25);
  expect(percent(3, 4)).toBe(75);
  expect(percent(1, 1)).toBe(100);
});
`;

export const verify: Verifier = async ({ repo, run, transcript }) => {
  const tests = await run("bun test src");
  if (tests.exitCode !== 0) return { ok: false, reason: "the suite still does not pass" };

  const suite = await run("cat src/calc.test.ts");
  if (!suite.stdout.includes("toBe(25)") || !suite.stdout.includes("toBe(40)")) {
    return { ok: false, reason: "assertions were dropped rather than the code fixed" };
  }

  await writeFile(join(repo, "verify-probe.test.ts"), PROBE, "utf8");
  const probe = await run("bun test verify-probe.test.ts");
  if (probe.exitCode !== 0) return { ok: false, reason: "percent() is still wrong" };

  const shellCalls = transcript.events.filter(
    (event) => event.type === "tool_start" && event.name === "shell",
  ).length;
  if (shellCalls < 2) {
    return { ok: false, reason: `only ${shellCalls} shell calls: the suite was not rerun` };
  }

  return { ok: true, reason: "both failures fixed in sequence, with the suite rerun" };
};
