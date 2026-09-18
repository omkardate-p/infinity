import { failureLine } from "../../checks.ts";
import type { FixtureMeta, Verifier } from "../../types.ts";

export const meta: FixtureMeta = {
  name: "rename-across-files",
  kind: "capability",
  fast: false,
  intent: "Find every use of a symbol across a project and rename all of them.",
};

export const task =
  "Rename the function fetchUser to loadUser everywhere in this project, including " +
  "its uses and the tests. The tests must still pass afterwards.";

export const verify: Verifier = async ({ run }) => {
  const stale = await run("grep -rn 'fetchUser' src || true");
  if (stale.stdout.trim()) {
    return {
      ok: false,
      reason: `fetchUser still appears: ${stale.stdout.trim().split("\n")[0]}`,
    };
  }

  for (const file of [
    "src/api.ts",
    "src/profile.ts",
    "src/greeting.ts",
    "src/users.test.ts",
  ]) {
    const contents = await run(`cat ${file}`);
    if (!contents.stdout.includes("loadUser")) {
      return { ok: false, reason: `${file} does not mention loadUser` };
    }
  }

  const tests = await run("bun test");
  if (tests.exitCode !== 0)
    return {
      ok: false,
      reason: `tests fail after the rename: ${failureLine(tests)}`,
    };

  return { ok: true, reason: "renamed in all four files with tests passing" };
};
