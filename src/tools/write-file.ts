/**
 * write_file: creates a file or replaces one wholesale. Replacing an existing
 * file is the destructive case, so the approval prompt says which of the two is
 * about to happen and how much content is being discarded.
 */

import { mkdir, readFile, stat, writeFile as fsWriteFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fail, ok, resolvePath, type Tool } from "./tool.ts";

const MAX_WRITE_BYTES = 1_000_000;

interface WriteFileInput {
  path: string;
  content: string;
}

export const writeFileTool: Tool = {
  name: "write_file",
  description:
    "Create a file, or replace an existing file's entire contents, inside the " +
    "workspace. To change part of a file that already exists, use edit_file instead.",
  inputSchema: {
    type: "object",
    required: ["path", "content"],
    properties: {
      path: { type: "string", description: "Path relative to the workspace root." },
      content: { type: "string", description: "Full contents of the file." },
    },
    additionalProperties: false,
  },

  async execute(input, ctx) {
    const { path, content } = input as WriteFileInput;

    const resolved = await resolvePath(ctx.workspace, path);
    if (!resolved.ok) return fail(resolved.reason, { reason: "path_rejected" });

    const size = Buffer.byteLength(content, "utf8");
    if (size > MAX_WRITE_BYTES) {
      return fail(`content is ${size} bytes, over the ${MAX_WRITE_BYTES} byte limit.`);
    }

    let existing: string | undefined;
    try {
      const info = await stat(resolved.path);
      if (info.isDirectory()) return fail(`${path} is a directory.`);
      existing = await readFile(resolved.path, "utf8");
    } catch {
      existing = undefined;
    }

    if (existing === content) {
      return ok(`${path} already has exactly this content; nothing was written.`, {
        path,
        unchanged: true,
      });
    }

    const decision = await ctx.requestApproval({
      tool: "write_file",
      summary:
        existing === undefined
          ? `create ${path} (${size} bytes)`
          : `overwrite ${path} (${Buffer.byteLength(existing, "utf8")} bytes replaced by ${size})`,
      detail: content.split("\n").slice(0, 40).join("\n"),
    });
    if (decision === "deny") {
      return fail(`the operator denied writing ${path}. The file is unchanged.`, {
        reason: "denied",
      });
    }

    try {
      await mkdir(dirname(resolved.path), { recursive: true });
      await fsWriteFile(resolved.path, content, "utf8");
    } catch (error) {
      return fail(`cannot write ${path}: ${(error as Error).message}`);
    }

    return ok(`${existing === undefined ? "Created" : "Overwrote"} ${path} (${size} bytes).`, {
      path,
      created: existing === undefined,
    });
  },
};
