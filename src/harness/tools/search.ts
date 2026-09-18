/**
 * search: a ripgrep wrapper. This is how the model finds code without reading
 * whole files, so the match count is capped before ok() caps the bytes: an
 * unbounded search is the fastest way to destroy a context window.
 */

import { fail, ok, resolvePath, type Tool } from "./tool.ts";

const DEFAULT_MAX_RESULTS = 60;
const SEARCH_TIMEOUT_MS = 20_000;

interface SearchInput {
  pattern: string;
  path?: string;
  glob?: string;
  max_results?: number;
  case_sensitive?: boolean;
}

export const search: Tool = {
  name: "search",
  description:
    "Search file contents in the workspace with ripgrep and return matching lines " +
    "with their file and line number. Prefer this over reading files when looking " +
    "for where something is defined or used.",
  inputSchema: {
    type: "object",
    required: ["pattern"],
    properties: {
      pattern: {
        type: "string",
        description: "Regular expression to search for.",
      },
      path: {
        type: "string",
        description:
          'File or directory to search, relative to the workspace root. Defaults to ".".',
      },
      glob: {
        type: "string",
        description: 'Limit to matching files, e.g. "*.ts". Optional.',
      },
      max_results: {
        type: "integer",
        minimum: 1,
        description: `Maximum matching lines to return. Defaults to ${DEFAULT_MAX_RESULTS}.`,
      },
      case_sensitive: {
        type: "boolean",
        description: "Match case exactly. Defaults to false (smart case).",
      },
    },
    additionalProperties: false,
  },

  async execute(input, ctx) {
    const {
      pattern,
      path = ".",
      glob,
      max_results = DEFAULT_MAX_RESULTS,
      case_sensitive = false,
    } = input as SearchInput;

    const resolved = await resolvePath(ctx.workspace, path);
    if (!resolved.ok) return fail(resolved.reason, { reason: "path_rejected" });

    const args = [
      "--line-number",
      "--no-heading",
      "--color=never",
      case_sensitive ? "--case-sensitive" : "--smart-case",
      // Cap per file as well as overall so one dense file cannot crowd out the rest.
      "--max-count",
      "20",
      ...(glob ? ["--glob", glob] : []),
      "--",
      pattern,
      resolved.path,
    ];

    const timeout = AbortSignal.timeout(SEARCH_TIMEOUT_MS);
    let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
    try {
      proc = Bun.spawn(["rg", ...args], {
        cwd: ctx.workspace,
        stdout: "pipe",
        stderr: "pipe",
        signal: AbortSignal.any([ctx.signal, timeout]),
      });
    } catch {
      return fail("ripgrep (rg) is not installed or not on PATH.", {
        reason: "rg_missing",
      });
    }

    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);

    // ripgrep exits 1 when there are no matches, which is not an error here.
    if (exitCode === 1 && stdout === "") {
      return ok(`No matches for /${pattern}/ in ${path}.`, { matches: 0 });
    }
    if (exitCode !== 0 && exitCode !== 1) {
      if (timeout.aborted)
        return fail(`search timed out after ${SEARCH_TIMEOUT_MS} ms.`);
      return fail(`search failed: ${stderr.trim() || `rg exited ${exitCode}`}`);
    }

    const lines = stdout.split("\n").filter((line) => line.length > 0);
    const shown = lines
      .slice(0, max_results)
      .map((line) => toWorkspaceRelative(line, ctx.workspace));

    const extra = lines.length - shown.length;
    const footer =
      extra > 0
        ? `\n... ${extra} more matching lines. Narrow the pattern or the glob.`
        : "";

    return ok(`${shown.join("\n")}${footer}`, {
      matches: lines.length,
      returned: shown.length,
    });
  },
};

// Output lines are "path:line:text", so only the leading workspace prefix is
// stripped; the rest is matched text and must not be touched.
function toWorkspaceRelative(line: string, workspace: string): string {
  const prefix = `${workspace}/`;
  if (line.startsWith(prefix)) return line.slice(prefix.length);
  if (line.startsWith(workspace))
    return line.slice(workspace.length).replace(/^[/:]/, "");
  return line;
}
