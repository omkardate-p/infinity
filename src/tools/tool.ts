/**
 * The tool boundary. Every tool declares a JSON Schema for its input, runs
 * against a workspace it may not leave, and returns a bounded result. The
 * agent loop never calls a tool's execute() without validating input first.
 */

import { dirname, isAbsolute, resolve } from "node:path";
import { realpath } from "node:fs/promises";

export interface ToolResult {
  /** False for any outcome the model should treat as a failed action. */
  ok: boolean;
  /** Bounded, model-visible output. Already truncated if it was oversized. */
  content: string;
  /** Set when content was cut, so the model knows it is not seeing everything. */
  truncated?: boolean;
  /**
   * Structured detail for the agent's own logs and for evals. Never counted on
   * to reach the model, which sees content.
   */
  meta?: Record<string, unknown>;
}

export type ApprovalDecision = "allow" | "deny";

export interface ApprovalRequest {
  tool: string;
  /** One-line summary shown to the operator, e.g. the command or the path. */
  summary: string;
  /** Full detail: the command line, or a diff of the proposed edit. */
  detail?: string;
}

export interface ToolContext {
  /** Absolute path. Fixed at startup and never widened during a session. */
  workspace: string;
  /**
   * Requests operator approval. Tools that mutate the workspace or execute
   * commands must await this before acting.
   */
  requestApproval(request: ApprovalRequest): Promise<ApprovalDecision>;
  /** Aborts long-running work. Wired to Ctrl-C by the CLI. */
  signal: AbortSignal;
}

export interface Tool {
  name: string;
  description: string;
  /** JSON Schema for the input object. Sent to the model and used to validate. */
  inputSchema: Record<string, unknown>;
  execute(input: unknown, ctx: ToolContext): Promise<ToolResult>;
}

/** Default ceiling on model-visible output from a single tool call. */
export const MAX_RESULT_BYTES = 24_000;

/**
 * Caps output at a byte budget, keeping the head and the tail. The tail matters
 * because compiler and test output puts the decisive lines last.
 */
export function bound(
  text: string,
  maxBytes: number = MAX_RESULT_BYTES,
): { content: string; truncated: boolean } {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes <= maxBytes) return { content: text, truncated: false };

  const buffer = Buffer.from(text, "utf8");
  const headBytes = Math.floor(maxBytes * 0.6);
  const tailBytes = maxBytes - headBytes;
  const head = buffer.subarray(0, headBytes).toString("utf8");
  const tail = buffer.subarray(buffer.length - tailBytes).toString("utf8");
  const omitted = bytes - maxBytes;

  return {
    content: `${head}\n\n... [${omitted} bytes omitted] ...\n\n${tail}`,
    truncated: true,
  };
}

export function ok(content: string, meta?: Record<string, unknown>): ToolResult {
  const bounded = bound(content);
  return {
    ok: true,
    content: bounded.content,
    ...(bounded.truncated ? { truncated: true } : {}),
    ...(meta ? { meta } : {}),
  };
}

/**
 * A failed action. The message is written for the model: it says what went
 * wrong and, where there is one, what to do instead.
 */
export function fail(message: string, meta?: Record<string, unknown>): ToolResult {
  const bounded = bound(message);
  return {
    ok: false,
    content: `Error: ${bounded.content}`,
    ...(bounded.truncated ? { truncated: true } : {}),
    ...(meta ? { meta } : {}),
  };
}

/**
 * Resolves a model-supplied path against the workspace and refuses anything
 * that lands outside it. This is the single enforcement point for the
 * workspace boundary; no tool may resolve a path any other way.
 *
 * Symlinks are resolved where the path exists, so a link pointing out of the
 * workspace is rejected rather than followed. For a path that does not exist
 * yet, the nearest existing ancestor is resolved instead, which is what makes
 * writing a new file inside a real directory safe.
 */
export async function resolvePath(
  workspace: string,
  input: string,
): Promise<{ ok: true; path: string } | { ok: false; reason: string }> {
  const root = await realpath(workspace);
  const candidate = isAbsolute(input) ? resolve(input) : resolve(root, input);

  // Resolve the deepest existing ancestor so that symlinks anywhere along the
  // path are collapsed before the containment check.
  let existing = candidate;
  let suffix = "";
  for (;;) {
    try {
      existing = await realpath(existing);
      break;
    } catch {
      const parent = dirname(existing);
      if (parent === existing) return { ok: false, reason: `cannot resolve path: ${input}` };
      suffix = suffix ? `${existing.slice(parent.length + 1)}/${suffix}` : existing.slice(parent.length + 1);
      existing = parent;
    }
  }

  const resolved = suffix ? resolve(existing, suffix) : existing;
  if (resolved !== root && !resolved.startsWith(`${root}/`)) {
    return {
      ok: false,
      reason: `path is outside the workspace and was refused: ${input}`,
    };
  }

  return { ok: true, path: resolved };
}
