#!/usr/bin/env bun

/**
 * The command line: infinity "task".
 *
 * Opens the interactive interface on a terminal, and streams plain lines
 * anywhere else or under --no-tui. Either way approval is asked before any
 * command or file change, and the current operation stops cleanly on interrupt.
 */

import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import pkg from "../package.json";
import { runTui } from "../tui/run.ts";
import { Agent, type AgentEvent } from "./agent/agent.ts";
import { listSessions, loadSession, type SessionState } from "./agent/state.ts";
import { createModel } from "./model/model.ts";
import { defaultTools, ToolRegistry } from "./tools/registry.ts";
import type { ApprovalDecision, ApprovalRequest } from "./tools/tool.ts";

const DEFAULT_MODEL = "ornith:9b";

const style = {
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
};

interface Options {
  task: string;
  model: string;
  provider: string;
  resume?: string;
  listSessions: boolean;
  autoApprove: boolean;
  showThinking: boolean;
  useTui: boolean;
  maxTurns?: number;
}

function parseArgs(argv: string[]): Options | { help: string } {
  const options: Options = {
    task: "",
    model: process.env.INFINITY_MODEL ?? DEFAULT_MODEL,
    provider: process.env.INFINITY_PROVIDER ?? "ollama",
    listSessions: false,
    autoApprove: false,
    showThinking: true,
    useTui: true,
  };
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]!;
    switch (argument) {
      case "-h":
      case "--help":
        return { help: usage() };
      case "--model":
        options.model = argv[++index] ?? "";
        break;
      case "--provider":
        options.provider = argv[++index] ?? "";
        break;
      case "--resume":
        options.resume = argv[++index] ?? "";
        break;
      case "--sessions":
        options.listSessions = true;
        break;
      case "--yes":
        options.autoApprove = true;
        break;
      case "--no-thinking":
        options.showThinking = false;
        break;
      case "--no-tui":
        options.useTui = false;
        break;
      case "--max-turns":
        options.maxTurns = Number(argv[++index]);
        break;
      default:
        if (argument.startsWith("-"))
          return { help: `Unknown flag: ${argument}\n\n${usage()}` };
        positional.push(argument);
    }
  }

  options.task = positional.join(" ");
  return options;
}

function usage(): string {
  return [
    'Usage: infinity "task"',
    "",
    `  --model <name>     Ollama model to use (default: ${DEFAULT_MODEL})`,
    "  --provider <name>  Model provider (default: ollama)",
    "  --resume <id>      Continue a saved session",
    "  --sessions         List saved sessions in this workspace",
    "  --max-turns <n>    Stop after n model turns",
    "  --no-thinking      Hide the model's reasoning",
    "  --no-tui           Stream plain lines instead of the interactive interface",
    "  --yes              Approve every action without asking (non-interactive runs)",
  ].join("\n");
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  if ("help" in parsed) {
    console.log(parsed.help);
    return 0;
  }

  // The workspace is fixed here, at startup, and never widens; PDF §9.
  const workspace = process.cwd();

  if (parsed.listSessions) {
    const sessions = await listSessions(workspace);
    console.log(
      sessions.length
        ? sessions.join("\n")
        : "No saved sessions in this workspace.",
    );
    return 0;
  }

  const model = createModel({ provider: parsed.provider, model: parsed.model });
  const registry = new ToolRegistry(defaultTools());
  const resumed = parsed.resume
    ? await loadSession(workspace, parsed.resume)
    : undefined;

  // A pipe cannot host an interactive interface, so a destination that is not a
  // terminal takes the line renderer whether or not it asked for one.
  if (parsed.useTui && stdout.isTTY) {
    return runTui({
      model,
      registry,
      workspace,
      version: pkg.version,
      maxTurns: parsed.maxTurns,
      resumed,
      initialTask: parsed.task || undefined,
      autoApprove: parsed.autoApprove,
    });
  }

  if (!parsed.task && !parsed.resume) {
    console.error(usage());
    return 2;
  }

  const prompts = createInterface({ input: stdin, output: stdout });

  const agent = new Agent({
    model,
    registry,
    workspace,
    ...(parsed.maxTurns ? { maxTurns: parsed.maxTurns } : {}),
    requestApproval: parsed.autoApprove
      ? async () => "allow"
      : (request) => askApproval(prompts, request),
  });

  let session: SessionState;
  if (resumed) {
    session = resumed;
    if (parsed.task)
      session.entries.push({
        message: { role: "user", content: parsed.task },
      });
    console.log(
      style.dim(
        `Resuming session ${session.id} (${session.turns} turns so far)`,
      ),
    );
  } else {
    session = agent.start(parsed.task);
  }

  const controller = new AbortController();
  let interrupts = 0;
  const onInterrupt = () => {
    interrupts++;
    if (interrupts === 1) {
      console.log(
        style.yellow(
          "\nInterrupted. Stopping after the current operation; Ctrl-C again to quit.",
        ),
      );
      controller.abort();
      return;
    }
    process.exit(130);
  };
  process.on("SIGINT", onInterrupt);

  console.log(style.dim(`workspace: ${workspace}`));
  console.log(style.dim(`model:     ${parsed.provider}/${parsed.model}`));
  console.log(style.dim(`session:   ${session.id}`));
  console.log();

  let exitCode = 0;
  try {
    for await (const event of agent.run(session, controller.signal)) {
      render(event, parsed.showThinking);
      if (event.type === "done" && event.reason !== "completed") exitCode = 1;
      if (event.type === "error") exitCode = 1;
    }
  } finally {
    process.off("SIGINT", onInterrupt);
    prompts.close();
  }

  return exitCode;
}

let lastChannel: "thinking" | "text" | "other" = "other";

function render(event: AgentEvent, showThinking: boolean): void {
  switch (event.type) {
    case "turn_start":
      breakLine();
      console.log(style.dim(`--- turn ${event.turn} ---`));
      break;

    case "thinking_delta":
      if (!showThinking) break;
      if (lastChannel !== "thinking") stdout.write(style.dim("thinking: "));
      stdout.write(style.dim(event.text));
      lastChannel = "thinking";
      break;

    case "text_delta":
      if (lastChannel === "thinking") stdout.write("\n\n");
      stdout.write(event.text);
      lastChannel = "text";
      break;

    case "tool_start":
      breakLine();
      console.log(style.bold(`> ${event.name} ${summarizeArgs(event.args)}`));
      break;

    case "tool_end": {
      const marker = event.ok ? style.green("ok") : style.red("failed");
      const preview = event.content.split("\n").slice(0, 8).join("\n");
      const hidden = event.content.split("\n").length - 8;
      console.log(
        `${marker} ${style.dim(preview)}${hidden > 0 ? style.dim(`\n  ... ${hidden} more lines`) : ""}`,
      );
      lastChannel = "other";
      break;
    }

    case "error":
      breakLine();
      console.error(style.red(`error: ${event.error.message}`));
      break;

    case "done":
      breakLine();
      console.log(
        style.dim(`--- ${event.reason} after ${event.turns} turns ---`),
      );
      break;
  }
}

function breakLine(): void {
  if (lastChannel !== "other") stdout.write("\n");
  lastChannel = "other";
}

function summarizeArgs(args: unknown): string {
  const summary = JSON.stringify(args ?? {});
  return summary.length > 120 ? `${summary.slice(0, 117)}...` : summary;
}

// Anything but an explicit yes denies, including a closed or exhausted stdin:
// an approval prompt nobody can answer must not become an approval.
async function askApproval(
  prompts: ReturnType<typeof createInterface>,
  request: ApprovalRequest,
): Promise<ApprovalDecision> {
  breakLine();
  console.log(style.yellow(`approve ${request.tool}: ${request.summary}`));
  if (request.detail) console.log(style.dim(request.detail));

  let answer: string;
  try {
    answer = await prompts.question("  run it? [y/N] ");
  } catch {
    console.log(style.dim("  no input available; denied."));
    return "deny";
  }
  const reply = answer.trim().toLowerCase();
  return reply === "y" || reply === "yes" ? "allow" : "deny";
}

process.exit(await main());
