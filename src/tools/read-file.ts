/**
 * read_file: reads a file inside the workspace. Output carries line numbers
 * because edit_file works on exact text and the model needs to see where that
 * text sits. Large files are read in windows rather than refused, so a big file
 * is still inspectable.
 */

import { readFile, stat } from "node:fs/promises";
import { fail, ok, resolvePath, type Tool } from "./tool.ts";

const MAX_FILE_BYTES = 2_000_000;
const DEFAULT_MAX_LINES = 600;

interface ReadFileInput {
  path: string;
  start_line?: number;
  max_lines?: number;
}

export const readFileTool: Tool = {
  name: "read_file",
  description:
    "Read a file inside the workspace. Returns numbered lines. " +
    "For a long file, read a window with start_line and max_lines.",
  requiresApproval: false,
  inputSchema: {
    type: "object",
    required: ["path"],
    properties: {
      path: { type: "string", description: "Path relative to the workspace root." },
      start_line: {
        type: "integer",
        minimum: 1,
        description: "First line to return, 1-based. Defaults to 1.",
      },
      max_lines: {
        type: "integer",
        minimum: 1,
        description: `Maximum lines to return. Defaults to ${DEFAULT_MAX_LINES}.`,
      },
    },
    additionalProperties: false,
  },

  async execute(input, ctx) {
    const { path, start_line = 1, max_lines = DEFAULT_MAX_LINES } = input as ReadFileInput;

    const resolved = await resolvePath(ctx.workspace, path);
    if (!resolved.ok) return fail(resolved.reason, { reason: "path_rejected" });

    let info;
    try {
      info = await stat(resolved.path);
    } catch {
      return fail(`no such file: ${path}`);
    }
    if (info.isDirectory()) return fail(`${path} is a directory. Use list_dir.`);
    if (info.size > MAX_FILE_BYTES) {
      return fail(
        `${path} is ${info.size} bytes, over the ${MAX_FILE_BYTES} byte limit. ` +
          "Use search to find the part you need.",
      );
    }
    if (info.size === 0) return ok(`${path} is empty.`, { lines: 0 });

    let text;
    try {
      text = await readFile(resolved.path, "utf8");
    } catch (error) {
      return fail(`cannot read ${path}: ${(error as Error).message}`);
    }

    const lines = text.split("\n");
    // A trailing newline produces a final empty element that is not a line.
    if (lines.at(-1) === "") lines.pop();

    if (start_line > lines.length) {
      return fail(`${path} has ${lines.length} lines; start_line ${start_line} is past the end.`);
    }

    const from = start_line - 1;
    const window = lines.slice(from, from + max_lines);
    const width = String(from + window.length).length;
    const numbered = window
      .map((line, index) => `${String(from + index + 1).padStart(width)}\t${line}`)
      .join("\n");

    const remaining = lines.length - (from + window.length);
    const footer = remaining > 0 ? `\n... ${remaining} more lines. Continue at start_line ${from + window.length + 1}.` : "";

    return ok(`${path} (lines ${from + 1}-${from + window.length} of ${lines.length}):\n${numbered}${footer}`, {
      totalLines: lines.length,
      returnedLines: window.length,
    });
  },
};
