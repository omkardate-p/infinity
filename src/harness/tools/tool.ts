/**
 * The tool boundary. Every tool declares a JSON Schema for its input, runs
 * against a workspace it may not leave, and returns a bounded result built
 * here. resolvePath is the only way a tool resolves a path; a tool that caps
 * its own output or formats its own error is a defect.
 */

import { realpath } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";

export interface ToolResult {
  ok: boolean;
  content: string;
  truncated?: boolean;
  // Read by the loop and the evals, never by the model, which sees content.
  meta?: Record<string, unknown>;
}

export type ApprovalDecision = "allow" | "deny";

export interface ApprovalRequest {
  tool: string;
  summary: string;
  detail?: string;
}

export interface ToolContext {
  // Absolute, fixed at startup, never widened during a session.
  workspace: string;
  requestApproval(request: ApprovalRequest): Promise<ApprovalDecision>;
  signal: AbortSignal;
}

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: unknown, ctx: ToolContext): Promise<ToolResult>;
}

export const MAX_RESULT_BYTES = 24_000;

// Keeps the head and the tail: compiler and test output puts the decisive lines
// last, so trimming only the end hides the failure.
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

export function ok(
  content: string,
  meta?: Record<string, unknown>,
): ToolResult {
  const bounded = bound(content);
  return {
    ok: true,
    content: bounded.content,
    ...(bounded.truncated ? { truncated: true } : {}),
    ...(meta ? { meta } : {}),
  };
}

export function fail(
  message: string,
  meta?: Record<string, unknown>,
): ToolResult {
  const bounded = bound(message);
  return {
    ok: false,
    content: `Error: ${bounded.content}`,
    ...(bounded.truncated ? { truncated: true } : {}),
    ...(meta ? { meta } : {}),
  };
}

export async function resolvePath(
  workspace: string,
  input: string,
): Promise<{ ok: true; path: string } | { ok: false; reason: string }> {
  const root = await realpath(workspace);
  const candidate = isAbsolute(input) ? resolve(input) : resolve(root, input);

  // Collapse symlinks at the deepest existing ancestor before the containment
  // check, so a link out of the workspace is refused rather than followed, and
  // a file that does not exist yet can still be created inside a real directory.
  let existing = candidate;
  let suffix = "";
  for (;;) {
    try {
      existing = await realpath(existing);
      break;
    } catch {
      const parent = dirname(existing);
      if (parent === existing)
        return { ok: false, reason: `cannot resolve path: ${input}` };
      suffix = suffix
        ? `${existing.slice(parent.length + 1)}/${suffix}`
        : existing.slice(parent.length + 1);
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
