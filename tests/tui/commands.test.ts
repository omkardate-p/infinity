/**
 * The commands the interface runs for itself. Nothing here reaches a model:
 * a command reads what the context gives it and reports what it changed, so
 * every one of them is checked without a terminal.
 */

import { describe, expect, test } from "bun:test";
import { createSession, saveSession } from "../../src/harness/agent/state.ts";
import type {
  Command,
  CommandContext,
} from "../../src/tui/commands/command.ts";
import {
  commandQuery,
  defaultCommands,
  matchCommands,
  parseCommand,
} from "../../src/tui/commands/registry.ts";
import { empty, type ViewModel } from "../../src/tui/state/view-model.ts";
import { makeWorkspace } from "../helpers.ts";

const commands = defaultCommands();

function find(name: string): Command {
  const command = commands.find((candidate) => candidate.name === name);
  if (!command) throw new Error(`no command ${name}`);
  return command;
}

// Every effect a command can have, in the order it had them.
function record(overrides: Partial<CommandContext> = {}) {
  const sessions: (string | undefined)[] = [];
  const transcripts: ViewModel[] = [];
  const models: string[] = [];
  const exits: string[] = [];

  const ctx: CommandContext = {
    workspace: "/tmp/nowhere",
    model: "ornith:9b",
    commands,
    setSession: (session) => sessions.push(session?.id),
    replaceTranscript: (view) => transcripts.push(view),
    setModel: (name) => models.push(name),
    onExit: () => exits.push("exit"),
    ...overrides,
  };

  return { ctx, sessions, transcripts, models, exits };
}

describe("what the menu is filtering", () => {
  test("a query is the word after the slash, and only while it is one word", () => {
    expect(commandQuery("/he")).toBe("he");
    expect(commandQuery("/")).toBe("");
    expect(commandQuery("/resume abc")).toBeUndefined();
    expect(commandQuery("fix the bug")).toBeUndefined();
  });

  test("everything matches an empty query, in the order the menu shows", () => {
    const names = matchCommands(commands, "").map((hit) => hit.command.name);

    expect(names).toEqual(commands.map((command) => command.name));
  });

  test("a name is found by what is inside it, not only by its start", () => {
    const hit = matchCommands(commands, "ear")[0];

    expect(hit?.command.name).toBe("clear");
    // Offsets into "/clear", which is what the menu draws.
    expect(hit?.start).toBe(3);
    expect(hit?.end).toBe(6);
  });

  test("a name that starts with the query comes before one that contains it", () => {
    const names = matchCommands(commands, "s").map((hit) => hit.command.name);

    expect(names[0]).toBe("sessions");
    expect(names).toContain("resume");
    expect(names).not.toContain("help");
  });

  test("an argument is whatever follows the name", () => {
    expect(parseCommand("/resume  20260918T083833-gkr8wl")).toEqual({
      name: "resume",
      args: "20260918T083833-gkr8wl",
    });
    expect(parseCommand("/help")).toEqual({ name: "help", args: "" });
  });
});

describe("/help", () => {
  test("names every command the menu offers", async () => {
    const recorded = record();

    const output = await find("help").run("", recorded.ctx);

    for (const command of commands) {
      expect(output).toContain(`/${command.name}`);
      expect(output).toContain(command.description);
    }
  });
});

describe("/clear", () => {
  test("drops the session and replaces the transcript with nothing", async () => {
    const recorded = record();

    await find("clear").run("", recorded.ctx);

    expect(recorded.sessions).toEqual([undefined]);
    expect(recorded.transcripts).toEqual([empty()]);
  });

  test("waits for the turn to end, rather than cutting it off", () => {
    expect(find("clear").needsIdle).toBe(true);
    expect(find("resume").needsIdle).toBe(true);
    expect(find("model").needsIdle).toBe(true);
    expect(find("help").needsIdle).toBeUndefined();
  });
});

describe("/sessions", () => {
  test("lists what this workspace saved", async () => {
    const workspace = await makeWorkspace();
    const session = createSession({
      workspace: workspace.root,
      model: "scripted",
      task: "fix the bug",
      entries: [{ message: { role: "user", content: "fix the bug" } }],
    });
    await saveSession(session);
    const recorded = record({ workspace: workspace.root });

    const output = await find("sessions").run("", recorded.ctx);

    expect(output).toContain(session.id);
  });

  test("says so when there are none", async () => {
    const workspace = await makeWorkspace();
    const recorded = record({ workspace: workspace.root });

    const output = await find("sessions").run("", recorded.ctx);

    expect(output).toBe("No saved sessions in this workspace.");
  });
});

describe("/resume", () => {
  test("rebuilds the transcript from what is on disk", async () => {
    const workspace = await makeWorkspace();
    const session = createSession({
      workspace: workspace.root,
      model: "scripted",
      task: "fix the bug",
      entries: [
        { message: { role: "system", content: "the working contract" } },
        { message: { role: "user", content: "fix the bug" } },
        { message: { role: "assistant", content: "Reading it." } },
      ],
    });
    session.turns = 2;
    await saveSession(session);
    const recorded = record({ workspace: workspace.root });

    const output = await find("resume").run(session.id, recorded.ctx);

    expect(recorded.sessions).toEqual([session.id]);
    expect(recorded.transcripts[0]?.turn).toBe(2);
    expect(recorded.transcripts[0]?.committed).toMatchObject([
      { kind: "user", text: "fix the bug" },
      { kind: "assistant", text: "Reading it." },
    ]);
    expect(output).toContain(session.id);
  });

  test("asks for an id rather than guessing one", async () => {
    const recorded = record();

    const output = await find("resume").run("", recorded.ctx);

    expect(output).toContain("/sessions");
    expect(recorded.transcripts).toHaveLength(0);
  });

  test("a session that is not there is reported, not swallowed", async () => {
    const workspace = await makeWorkspace();
    const recorded = record({ workspace: workspace.root });

    expect(find("resume").run("nope", recorded.ctx)).rejects.toThrow(
      "No session nope",
    );
  });
});

describe("/model", () => {
  test("reports the running model when given no name", async () => {
    const recorded = record();

    const output = await find("model").run("", recorded.ctx);

    expect(output).toContain("ornith:9b");
    expect(recorded.models).toHaveLength(0);
  });

  test("switches to the name it was given", async () => {
    const recorded = record();

    const output = await find("model").run("qwen3:4b", recorded.ctx);

    expect(recorded.models).toEqual(["qwen3:4b"]);
    expect(output).toContain("qwen3:4b");
  });
});

describe("/exit", () => {
  test("puts the terminal back through the caller", async () => {
    const recorded = record();

    await find("exit").run("", recorded.ctx);

    expect(recorded.exits).toEqual(["exit"]);
  });
});
