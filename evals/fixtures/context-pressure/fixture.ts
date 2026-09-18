import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FixtureMeta, Verifier } from "../../types.ts";

export const meta: FixtureMeta = {
  name: "context-pressure",
  kind: "trap",
  fast: false,
  intent:
    "Forty modules, 3600 lines. Reading them all exceeds the window, so search is " +
    "the only route to the one constant that matters.",
};

export const task =
  "Change the retry budget used by this project from 3 to 7. It is a single constant.";

const PROBE = `import { expect, test } from "bun:test";
import { MAX_RETRY_BUDGET } from "./src/modules/retry-policy.ts";

test("the retry budget is seven", () => {
  expect(MAX_RETRY_BUDGET).toBe(7);
});
`;

export const verify: Verifier = async ({ repo, run, transcript }) => {
  await writeFile(join(repo, "verify-probe.test.ts"), PROBE, "utf8");
  const probe = await run("bun test verify-probe.test.ts");
  if (probe.exitCode !== 0) {
    return { ok: false, reason: "MAX_RETRY_BUDGET is not 7" };
  }

  const source = join(import.meta.dir, "repo", "src", "modules");
  const target = join(repo, "src", "modules");
  for (const file of await readdir(source)) {
    if (file === "retry-policy.ts") continue;
    const [before, after] = await Promise.all([
      readFile(join(source, file), "utf8"),
      readFile(join(target, file), "utf8").catch(() => ""),
    ]);
    if (before !== after)
      return {
        ok: false,
        reason: `${file} was edited, but only one constant changed`,
      };
  }

  const searches = transcript.events.filter(
    (event) => event.type === "tool_start" && event.name === "search",
  ).length;
  const reads = transcript.events.filter(
    (event) => event.type === "tool_start" && event.name === "read_file",
  ).length;

  return {
    ok: true,
    reason: `budget changed with ${searches} searches and ${reads} file reads`,
  };
};
