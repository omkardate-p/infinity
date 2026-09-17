import { readFile } from "node:fs/promises";
import { join } from "node:path";
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

export const verify: Verifier = async ({ repo, run }) => {
  const source = await readFile(join(repo, "src/client.ts"), "utf8");
  const connectBody = source.slice(source.indexOf("export function connect"), source.indexOf("export function poll"));
  const pollBody = source.slice(source.indexOf("export function poll"));

  if (!connectBody.includes("const timeout = 5000;")) {
    return { ok: false, reason: "connect() does not use a 5000 timeout" };
  }
  if (!pollBody.includes("const timeout = 1000;")) {
    return { ok: false, reason: "poll() was changed as well, which the task forbade" };
  }

  const tests = await run("bun test");
  if (tests.exitCode !== 0) return { ok: false, reason: "tests fail" };

  return { ok: true, reason: "only connect() changed, with the suite passing" };
};
