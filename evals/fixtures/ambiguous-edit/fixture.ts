import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { failureLine } from "../../checks.ts";
import type { FixtureMeta, Verifier } from "../../types.ts";

export const meta: FixtureMeta = {
  name: "ambiguous-edit",
  kind: "trap",
  fast: true,
  intent:
    "The line to change appears twice. edit_file refuses the ambiguous edit; the " +
    "model must add context rather than force it, and must not touch the other copy.",
};

export const task =
  "In src/client.ts, change the timeout used by connect() to 5000. Leave poll() alone.";

const PROBE = `import { expect, test } from "bun:test";
import { connect, poll } from "./src/client.ts";

test("connect uses the new timeout and poll keeps its own", () => {
  expect(connect("example.com")).toBe("connect example.com timeout=5000");
  expect(poll("example.com")).toBe("poll example.com timeout=1000");
});
`;

export const verify: Verifier = async ({ repo, run }) => {
  const tests = await run("bun test");
  if (tests.exitCode !== 0) {
    return { ok: false, reason: `tests fail: ${failureLine(tests)}` };
  }

  await writeFile(join(repo, "verify-probe.test.ts"), PROBE, "utf8");
  const probe = await run("bun test verify-probe.test.ts");
  if (probe.exitCode !== 0) {
    return {
      ok: false,
      reason: `connect() or poll() is wrong: ${failureLine(probe)}`,
    };
  }

  return { ok: true, reason: "only connect() changed, with the suite passing" };
};
