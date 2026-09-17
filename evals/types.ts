/**
 * Contract between the harness and a fixture. A fixture is a tiny repository
 * plus a task and a verifier; the verifier decides pass or fail from the
 * repository's final state and the recorded transcript, never from a human
 * reading the output.
 */

import type { AgentEvent, AgentStopReason } from "../src/agent/agent.ts";
import type { ApprovalDecision, ApprovalRequest } from "../src/tools/tool.ts";

export interface Transcript {
  events: AgentEvent[];
  /** Assistant text across all turns, concatenated. */
  finalText: string;
  turns: number;
  stopReason: AgentStopReason;
}

export interface VerifyContext {
  /** Absolute path to the copy of the repository the agent worked in. */
  repo: string;
  transcript: Transcript;
  /** Runs a command in the repo and returns its exit code and output. */
  run(
    command: string,
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export interface VerifyResult {
  ok: boolean;
  /** Why it failed, or what was confirmed when it passed. */
  reason: string;
}

export type Verifier = (ctx: VerifyContext) => Promise<VerifyResult>;

/**
 * How the fixture answers approval requests. Fixtures run unattended and allow
 * everything by default. A fixture supplies this only when the behaviour under
 * test is what happens when the operator says no, which for shell is the only
 * control there is: the workspace boundary constrains the file tools, and a
 * command's reach is bounded by the operator, not by resolvePath.
 */
export type Approver = (request: ApprovalRequest) => ApprovalDecision;

export interface FixtureMeta {
  /** Directory name under evals/fixtures. */
  name: string;
  /** "capability" for ordinary tasks, "trap" for targeted failure modes. */
  kind: "capability" | "trap";
  /** In the fast subset, run for iteration rather than for a full baseline. */
  fast: boolean;
  /** What this fixture is actually testing, in one line. */
  intent: string;
}
