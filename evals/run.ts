#!/usr/bin/env bun
/**
 * The evaluation harness. It copies each fixture repository to a temporary
 * directory, runs the agent against it, and asks the fixture's verifier whether
 * the work is correct.
 *
 * The agent is driven through the Agent class rather than the CLI so that every
 * event is counted: turns, tool calls by name, malformed calls, failed edits and
 * denials. Those counters separate "the model was not smart enough" from "our
 * schemas or tools were wrong", which is the distinction that matters early.
 *
 * Every task runs several times. A single run of a small model says nothing.
 */

import { cp, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent, type AgentEvent } from "../src/agent/agent.ts";
import { createModel } from "../src/model/model.ts";
import { defaultTools, ToolRegistry } from "../src/tools/registry.ts";
import type {
  Approver,
  FixtureMeta,
  Transcript,
  Verifier,
  VerifyContext,
  VerifyResult,
} from "./types.ts";

const FIXTURES_DIR = join(import.meta.dir, "fixtures");
const DEFAULT_MODEL = "ornith:9b";
const DEFAULT_REPEATS = 3;
const DEFAULT_MAX_TURNS = 25;
/** A single run that hangs must not stall an overnight sweep. */
const RUN_TIMEOUT_MS = 10 * 60 * 1000;

interface RunRecord {
  task: string;
  kind: FixtureMeta["kind"];
  attempt: number;
  passed: boolean;
  reason: string;
  turns: number;
  stopReason: string;
  elapsedMs: number;
  toolCalls: Record<string, number>;
  /** Calls the model made that our layer rejected before any tool ran. */
  malformedCalls: number;
  /** edit_file calls that found no match or an ambiguous one. */
  failedEdits: number;
  deniedCalls: number;
}

interface Options {
  model: string;
  provider: string;
  repeats: number;
  maxTurns: number;
  fastOnly: boolean;
  only: string[];
  out: string | undefined;
}

function parseArgs(argv: string[]): Options {
  const options: Options = {
    model: process.env.INFINITY_MODEL ?? DEFAULT_MODEL,
    provider: process.env.INFINITY_PROVIDER ?? "ollama",
    repeats: DEFAULT_REPEATS,
    maxTurns: DEFAULT_MAX_TURNS,
    fastOnly: false,
    only: [],
    out: undefined,
  };

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!;
    if (argument === "--model") options.model = argv[++index]!;
    else if (argument === "--provider") options.provider = argv[++index]!;
    else if (argument === "--repeats") options.repeats = Number(argv[++index]);
    else if (argument === "--max-turns")
      options.maxTurns = Number(argv[++index]);
    else if (argument === "--fast") options.fastOnly = true;
    else if (argument === "--out") options.out = argv[++index]!;
    else if (argument === "--task") options.only.push(argv[++index]!);
    else if (argument === "-h" || argument === "--help") {
      console.log(
        [
          "Usage: bun run evals/run.ts [options]",
          "",
          "  --model <name>    Model to evaluate (default: " +
            DEFAULT_MODEL +
            ")",
          "  --provider <name> Model provider (default: ollama)",
          "  --repeats <n>     Runs per task (default: " +
            DEFAULT_REPEATS +
            ")",
          "  --fast            Only the fast subset, for iteration",
          "  --task <name>     Run one fixture; repeatable",
          "  --max-turns <n>   Turn budget per run (default: " +
            DEFAULT_MAX_TURNS +
            ")",
          "  --out <path>      Write the run records as JSON",
        ].join("\n"),
      );
      process.exit(0);
    }
  }
  return options;
}

interface LoadedFixture {
  meta: FixtureMeta;
  task: string;
  verify: Verifier;
  approve: Approver | undefined;
  repo: string;
}

async function loadFixtures(options: Options): Promise<LoadedFixture[]> {
  const names = (await readdir(FIXTURES_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const fixtures: LoadedFixture[] = [];
  for (const name of names) {
    if (options.only.length && !options.only.includes(name)) continue;

    const dir = join(FIXTURES_DIR, name);
    const module = (await import(join(dir, "fixture.ts"))) as {
      meta: FixtureMeta;
      task: string;
      verify: Verifier;
      approve?: Approver;
    };
    if (options.fastOnly && !module.meta.fast) continue;

    fixtures.push({
      meta: module.meta,
      task: module.task,
      verify: module.verify,
      approve: module.approve,
      repo: join(dir, "repo"),
    });
  }
  return fixtures;
}

async function runOnce(
  fixture: LoadedFixture,
  attempt: number,
  options: Options,
): Promise<RunRecord> {
  const workspace = await mkdtemp(
    join(tmpdir(), `infinity-eval-${fixture.meta.name}-`),
  );
  const started = Date.now();

  const events: AgentEvent[] = [];
  const toolCalls: Record<string, number> = {};
  let malformedCalls = 0;
  let failedEdits = 0;
  let deniedCalls = 0;
  let finalText = "";
  let turns = 0;
  let stopReason = "unknown";

  try {
    await cp(fixture.repo, workspace, { recursive: true });

    const agent = new Agent({
      model: createModel({ provider: options.provider, model: options.model }),
      registry: new ToolRegistry(defaultTools()),
      workspace,
      maxTurns: options.maxTurns,
      requestApproval: async (request) => fixture.approve?.(request) ?? "allow",
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
    const session = agent.start(fixture.task);

    try {
      for await (const event of agent.run(session, controller.signal)) {
        events.push(event);
        if (event.type === "text_delta") finalText += event.text;
        if (event.type === "tool_start") {
          toolCalls[event.name] = (toolCalls[event.name] ?? 0) + 1;
        }
        if (event.type === "tool_end" && !event.ok) {
          if (
            event.content.includes("unknown tool") ||
            event.content.includes("invalid arguments")
          ) {
            malformedCalls++;
          }
          if (event.name === "edit_file") failedEdits++;
          if (event.content.includes("denied")) deniedCalls++;
        }
        if (event.type === "done") {
          turns = event.turns;
          stopReason = event.reason;
        }
      }
    } finally {
      clearTimeout(timer);
    }

    const transcript: Transcript = {
      events,
      finalText,
      turns,
      stopReason: stopReason as Transcript["stopReason"],
    };

    const verdict = await verifySafely(fixture.verify, {
      repo: workspace,
      transcript,
      run: runner(workspace),
    });

    return {
      task: fixture.meta.name,
      kind: fixture.meta.kind,
      attempt,
      passed: verdict.ok,
      reason: verdict.reason,
      turns,
      stopReason,
      elapsedMs: Date.now() - started,
      toolCalls,
      malformedCalls,
      failedEdits,
      deniedCalls,
    };
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

/** A verifier that throws is a broken fixture, and must not abort the sweep. */
async function verifySafely(
  verify: Verifier,
  ctx: VerifyContext,
): Promise<VerifyResult> {
  try {
    return await verify(ctx);
  } catch (error) {
    return { ok: false, reason: `verifier threw: ${(error as Error).message}` };
  }
}

function runner(cwd: string): VerifyContext["run"] {
  return async (command: string) => {
    const proc = Bun.spawn(["/bin/sh", "-c", command], {
      cwd,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { exitCode, stdout, stderr };
  };
}

function summarize(records: RunRecord[]): void {
  const byTask = new Map<string, RunRecord[]>();
  for (const record of records) {
    byTask.set(record.task, [...(byTask.get(record.task) ?? []), record]);
  }

  console.log("\n=== results ===");
  for (const [task, runs] of byTask) {
    const passes = runs.filter((run) => run.passed).length;
    const meanTurns = mean(runs.map((run) => run.turns));
    const meanSeconds = mean(runs.map((run) => run.elapsedMs)) / 1000;
    const malformed = runs.reduce(
      (total, run) => total + run.malformedCalls,
      0,
    );
    const badEdits = runs.reduce((total, run) => total + run.failedEdits, 0);

    console.log(
      `${task.padEnd(26)} ${passes}/${runs.length} pass  ` +
        `${meanTurns.toFixed(1)} turns  ${meanSeconds.toFixed(0)}s  ` +
        `${malformed} malformed  ${badEdits} failed edits`,
    );
    for (const run of runs.filter((candidate) => !candidate.passed)) {
      console.log(`  attempt ${run.attempt}: ${run.reason}`);
    }
  }

  const passed = records.filter((record) => record.passed).length;
  console.log(`\noverall: ${passed}/${records.length} runs passed`);
}

function mean(values: number[]): number {
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

const options = parseArgs(process.argv.slice(2));
const fixtures = await loadFixtures(options);

if (fixtures.length === 0) {
  console.error("No fixtures matched.");
  process.exit(2);
}

console.log(
  `model ${options.provider}/${options.model} | ${fixtures.length} fixtures | ${options.repeats} repeats`,
);

const records: RunRecord[] = [];
for (const fixture of fixtures) {
  for (let attempt = 1; attempt <= options.repeats; attempt++) {
    process.stdout.write(
      `running ${fixture.meta.name} (${attempt}/${options.repeats}) ... `,
    );
    const record = await runOnce(fixture, attempt, options);
    records.push(record);
    console.log(
      `${record.passed ? "pass" : "FAIL"} ${record.turns} turns ${(record.elapsedMs / 1000).toFixed(0)}s`,
    );
  }
}

summarize(records);

if (options.out) {
  await writeFile(
    options.out,
    `${JSON.stringify({ model: options.model, records }, null, 2)}\n`,
    "utf8",
  );
  console.log(`\nwrote ${options.out}`);
}

process.exit(records.every((record) => record.passed) ? 0 : 1);
