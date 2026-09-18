/**
 * edit_file: replaces an exact run of text in a file. The match must be exact
 * and it must be unique. An edit that could land in more than one place is
 * refused rather than guessed at, because a wrong guess silently corrupts a
 * file and the model will believe it succeeded.
 */

import { readFile, writeFile } from "node:fs/promises";
import { fail, ok, resolvePath, type Tool } from "./tool.ts";

interface EditFileInput {
  path: string;
  old_text: string;
  new_text: string;
}

export const editFile: Tool = {
  name: "edit_file",
  description:
    "Replace an exact, unique run of text in a file. old_text must match the file " +
    "byte for byte, including indentation, and must appear exactly once. Include " +
    "surrounding lines to make it unique. Read the file first.",
  inputSchema: {
    type: "object",
    required: ["path", "old_text", "new_text"],
    properties: {
      path: {
        type: "string",
        description: "Path relative to the workspace root.",
      },
      old_text: {
        type: "string",
        minLength: 1,
        description:
          "Exact existing text to replace. Must occur exactly once in the file.",
      },
      new_text: {
        type: "string",
        description: "Replacement text. May be empty to delete.",
      },
    },
    additionalProperties: false,
  },

  async execute(input, ctx) {
    const { path, old_text, new_text } = input as EditFileInput;

    const resolved = await resolvePath(ctx.workspace, path);
    if (!resolved.ok) return fail(resolved.reason, { reason: "path_rejected" });

    if (old_text === new_text) {
      return fail(
        "old_text and new_text are identical, so this edit would do nothing.",
        {
          reason: "no_op_edit",
        },
      );
    }

    let contents: string;
    try {
      contents = await readFile(resolved.path, "utf8");
    } catch {
      return fail(`no such file: ${path}. Use write_file to create it.`, {
        reason: "missing_file",
      });
    }

    const occurrences = countOccurrences(contents, old_text);
    if (occurrences === 0) {
      return fail(
        `old_text was not found in ${path}. Read the file and copy the exact text, ` +
          "including whitespace.",
        { reason: "no_match" },
      );
    }
    if (occurrences > 1) {
      return fail(
        `old_text appears ${occurrences} times in ${path}, so the edit is ambiguous. ` +
          "Include more surrounding context so it matches exactly once.",
        { reason: "ambiguous_match", occurrences },
      );
    }

    const decision = await ctx.requestApproval({
      tool: "edit_file",
      summary: `edit ${path}`,
      detail: renderDiff(contents, old_text, new_text),
    });
    if (decision === "deny") {
      return fail(
        `the operator denied the edit to ${path}. The file is unchanged.`,
        {
          reason: "denied",
        },
      );
    }

    const updated = contents.replace(old_text, new_text);
    try {
      await writeFile(resolved.path, updated, "utf8");
    } catch (error) {
      return fail(`cannot write ${path}: ${(error as Error).message}`);
    }

    const lineOffset = contents
      .slice(0, contents.indexOf(old_text))
      .split("\n").length;
    return ok(`Edited ${path} at line ${lineOffset}.`, {
      path,
      line: lineOffset,
    });
  },
};

// Non-overlapping, which is what the String.replace below acts on.
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count++;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function renderDiff(
  contents: string,
  oldText: string,
  newText: string,
): string {
  const startLine = contents
    .slice(0, contents.indexOf(oldText))
    .split("\n").length;
  const removed = oldText.split("\n").map((line) => `- ${line}`);
  const added =
    newText === "" ? [] : newText.split("\n").map((line) => `+ ${line}`);
  return [`@@ line ${startLine} @@`, ...removed, ...added].join("\n");
}
