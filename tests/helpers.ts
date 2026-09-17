/**
 * Shared fixtures for the runtime tests. These tests never call a model: they
 * exercise the tool layer directly so that a failure points at our code rather
 * than at the model's judgement.
 */

import { mkdtemp, mkdir, writeFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { ApprovalDecision, ApprovalRequest, ToolContext } from "../src/tools/tool.ts";

export interface TestWorkspace {
  root: string;
  /** Approval requests seen so far, in order. */
  approvals: ApprovalRequest[];
  ctx: ToolContext;
  write(relativePath: string, contents: string): Promise<string>;
}

export async function makeWorkspace(
  options: { approval?: ApprovalDecision; signal?: AbortSignal } = {},
): Promise<TestWorkspace> {
  // realpath because macOS puts temp directories behind a /var -> /private/var
  // symlink, and the workspace boundary check compares resolved paths.
  const root = await realpath(await mkdtemp(join(tmpdir(), "agent-test-")));
  const approvals: ApprovalRequest[] = [];

  const ctx: ToolContext = {
    workspace: root,
    async requestApproval(request: ApprovalRequest): Promise<ApprovalDecision> {
      approvals.push(request);
      return options.approval ?? "allow";
    },
    signal: options.signal ?? new AbortController().signal,
  };

  return {
    root,
    approvals,
    ctx,
    async write(relativePath: string, contents: string) {
      const full = join(root, relativePath);
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, contents, "utf8");
      return full;
    },
  };
}
