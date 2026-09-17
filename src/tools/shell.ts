/**
 * shell: runs a command in the workspace. The dangerous tool, so every bound is
 * explicit: the operator approves the exact command line, the process runs with
 * cwd inside the workspace, output is captured up to a byte ceiling, and the
 * process is killed on timeout or on Ctrl-C.
 */

import { bound, fail, resolvePath, type Tool, type ToolResult } from "./tool.ts";

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_TIMEOUT_MS = 600_000;
const MAX_OUTPUT_BYTES = 20_000;
/** Grace period between SIGTERM and SIGKILL for a process that ignores the first. */
const KILL_GRACE_MS = 2_000;

interface ShellInput {
  command: string;
  cwd?: string;
  timeout_ms?: number;
}

export const shell: Tool = {
  name: "shell",
  description:
    "Run a shell command inside the workspace and return its exit code, stdout " +
    "and stderr. Use this to run tests, builds and version control commands. " +
    "The command is killed if it exceeds its timeout.",
  requiresApproval: true,
  inputSchema: {
    type: "object",
    required: ["command"],
    properties: {
      command: { type: "string", minLength: 1, description: "The command line to run." },
      cwd: {
        type: "string",
        description: 'Directory to run in, relative to the workspace root. Defaults to ".".',
      },
      timeout_ms: {
        type: "integer",
        minimum: 1000,
        maximum: MAX_TIMEOUT_MS,
        description: `Timeout in milliseconds. Defaults to ${DEFAULT_TIMEOUT_MS}.`,
      },
    },
    additionalProperties: false,
  },

  async execute(input, ctx) {
    const { command, cwd = ".", timeout_ms = DEFAULT_TIMEOUT_MS } = input as ShellInput;

    const resolved = await resolvePath(ctx.workspace, cwd);
    if (!resolved.ok) return fail(resolved.reason, { reason: "path_rejected" });

    const decision = await ctx.requestApproval({
      tool: "shell",
      summary: command,
      ...(cwd === "." ? {} : { detail: `cwd: ${cwd}` }),
    });
    if (decision === "deny") {
      return fail(`the operator denied running: ${command}. Nothing was executed.`, {
        reason: "denied",
      });
    }

    let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
    try {
      proc = Bun.spawn(["/bin/sh", "-c", command], {
        cwd: resolved.path,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
    } catch (error) {
      return fail(`cannot start command: ${(error as Error).message}`);
    }

    let outcome: "exited" | "timeout" | "aborted" = "exited";

    const stop = (reason: "timeout" | "aborted") => {
      if (outcome !== "exited" || proc.killed) return;
      outcome = reason;
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
      }, KILL_GRACE_MS).unref();
    };

    const timer = setTimeout(() => stop("timeout"), timeout_ms);
    const onAbort = () => stop("aborted");
    ctx.signal.addEventListener("abort", onAbort, { once: true });

    let stdout = "";
    let stderr = "";
    let exitCode: number | null = null;
    try {
      [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
    } finally {
      clearTimeout(timer);
      ctx.signal.removeEventListener("abort", onAbort);
    }

    return render({ command, stdout, stderr, exitCode, outcome, timeout_ms });
  },
};

function render(run: {
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  outcome: "exited" | "timeout" | "aborted";
  timeout_ms: number;
}): ToolResult {
  const sections: string[] = [];
  if (run.stdout.trim()) sections.push(`stdout:\n${run.stdout.trimEnd()}`);
  if (run.stderr.trim()) sections.push(`stderr:\n${run.stderr.trimEnd()}`);
  if (sections.length === 0) sections.push("(no output)");

  const body = bound(sections.join("\n\n"), MAX_OUTPUT_BYTES);

  if (run.outcome === "timeout") {
    return {
      ok: false,
      content:
        `Error: command timed out after ${run.timeout_ms} ms and was killed: ${run.command}\n\n` +
        body.content,
      ...(body.truncated ? { truncated: true } : {}),
      meta: { reason: "timeout", timeoutMs: run.timeout_ms },
    };
  }

  if (run.outcome === "aborted") {
    return {
      ok: false,
      content: `Error: command was interrupted and killed: ${run.command}\n\n${body.content}`,
      ...(body.truncated ? { truncated: true } : {}),
      meta: { reason: "aborted" },
    };
  }

  const succeeded = run.exitCode === 0;
  return {
    ok: succeeded,
    content: `exit code: ${run.exitCode}\n\n${body.content}`,
    ...(body.truncated ? { truncated: true } : {}),
    meta: { exitCode: run.exitCode },
  };
}
