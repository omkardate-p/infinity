/**
 * list_dir: the model's first look at a repository. Output is bounded by entry
 * count so that a directory with thousands of files cannot fill the context.
 */

import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { relative } from "node:path";
import { fail, ok, resolvePath, type Tool } from "./tool.ts";

const MAX_ENTRIES = 200;

// Hidden from a bare listing only; naming one explicitly still reaches it.
const NOISE = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  "coverage",
]);

interface ListDirInput {
  path?: string;
}

export const listDir: Tool = {
  name: "list_dir",
  description:
    "List the files and directories at a path inside the workspace. " +
    'Use "." for the workspace root. Directories are marked with a trailing slash.',
  inputSchema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          'Path relative to the workspace root. Defaults to "." (the root).',
      },
    },
    additionalProperties: false,
  },

  async execute(input, ctx) {
    const { path = "." } = input as ListDirInput;

    const resolved = await resolvePath(ctx.workspace, path);
    if (!resolved.ok) return fail(resolved.reason, { reason: "path_rejected" });

    let entries: Dirent[];
    try {
      entries = await readdir(resolved.path, { withFileTypes: true });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOTDIR")
        return fail(`${path} is a file, not a directory. Use read_file.`);
      if (code === "ENOENT") return fail(`no such directory: ${path}`);
      return fail(`cannot list ${path}: ${(error as Error).message}`);
    }

    const visible = entries
      .filter((entry) => !NOISE.has(entry.name))
      .sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory())
          return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

    const hidden = entries.length - visible.length;
    const shown = visible.slice(0, MAX_ENTRIES);
    const lines = shown.map((entry) =>
      entry.isDirectory() ? `${entry.name}/` : entry.name,
    );

    if (visible.length > MAX_ENTRIES) {
      lines.push(`... ${visible.length - MAX_ENTRIES} more entries not shown`);
    }
    if (hidden > 0) {
      lines.push(`(${hidden} generated or version-control entries omitted)`);
    }
    if (lines.length === 0) lines.push("(empty directory)");

    const label = relative(ctx.workspace, resolved.path) || ".";
    return ok(`${label}:\n${lines.join("\n")}`, {
      entries: visible.length,
      path: label,
    });
  },
};
