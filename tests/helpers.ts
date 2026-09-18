/**
 * Shared fixtures for the runtime tests. These tests never call a model: they
 * exercise the tool layer directly so that a failure points at our code rather
 * than at the model's judgement.
 */

import { mkdir, mkdtemp, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type {
  Model,
  ModelEvent,
  ModelRequest,
} from "../src/harness/model/types.ts";
import type {
  ApprovalDecision,
  ApprovalRequest,
  ToolContext,
} from "../src/harness/tools/tool.ts";

export interface TestWorkspace {
  root: string;
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

export type ScriptedTurn =
  | {
      text: string;
      calls?: { name: string; args: unknown }[];
      promptTokens?: number;
    }
  | { error: string }
  // A transport failure: the stream throws rather than reporting an error.
  | { throws: string };

// A model that replays a fixed script. The real Agent drives it, so a test gets
// the real event stream without anything reaching Ollama.
export class ScriptedModel implements Model {
  readonly id = "scripted";
  readonly requests: ModelRequest[] = [];
  private index = 0;

  // A delay between deltas, for tests that need a turn still in flight.
  constructor(
    private readonly script: ScriptedTurn[],
    private readonly delayMs = 0,
  ) {}

  async *stream(request: ModelRequest): AsyncIterable<ModelEvent> {
    this.requests.push({ ...request, messages: [...request.messages] });
    const turn = this.script[this.index++] ?? { text: "done" };

    if ("throws" in turn) throw new Error(turn.throws);

    if ("error" in turn) {
      yield { type: "error", error: new Error(turn.error) };
      return;
    }

    yield { type: "thinking_delta", text: "considering" };
    for (const character of turn.text) {
      if (this.delayMs > 0) await Bun.sleep(this.delayMs);
      yield { type: "text_delta", text: character };
    }
    for (const [index, call] of (turn.calls ?? []).entries()) {
      yield {
        type: "tool_call",
        id: `call_${this.index}_${index}`,
        name: call.name,
        args: call.args,
      };
    }
    yield {
      type: "done",
      stopReason: turn.calls?.length ? "tool_calls" : "end_turn",
      ...(turn.promptTokens !== undefined
        ? { promptTokens: turn.promptTokens }
        : {}),
    };
  }
}
