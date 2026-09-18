/**
 * Resuming a session on screen. The interesting part is pairing a tool result
 * back to the arguments it was called with, which live on a different entry.
 */

import { describe, expect, test } from "bun:test";
import {
  createSession,
  loadSession,
  saveSession,
  type SessionEntry,
} from "../src/agent/state.ts";
import { restore } from "../tui/history.ts";
import { makeWorkspace } from "./helpers.ts";

const conversation: SessionEntry[] = [
  { message: { role: "system", content: "the working contract" } },
  { message: { role: "user", content: "fix the bug" } },
  {
    message: {
      role: "assistant",
      content: "Reading it.",
      toolCalls: [
        { id: "call_1", name: "read_file", args: { path: "src/cli.ts" } },
      ],
    },
  },
  {
    message: {
      role: "tool",
      content: "82 lines",
      name: "read_file",
      toolCallId: "call_1",
    },
    ok: true,
  },
  { message: { role: "user", content: "now run the tests" } },
  {
    message: {
      role: "assistant",
      content: "",
      toolCalls: [{ id: "call_2", name: "shell", args: { command: "bun test" } }],
    },
  },
  {
    message: {
      role: "tool",
      content: "Error: the operator denied running: bun test.",
      name: "shell",
      toolCallId: "call_2",
    },
    ok: false,
  },
];

describe("restore", () => {
  test("the working contract is not part of the conversation", () => {
    const view = restore(conversation);

    expect(view.committed.some((item) => item.kind === "user" && item.text.includes("contract"))).toBe(false);
  });

  test("a tool call is paired with the arguments that requested it", () => {
    const view = restore(conversation);

    expect(view.committed).toMatchObject([
      { kind: "user", text: "fix the bug" },
      { kind: "assistant", text: "Reading it." },
      {
        kind: "tool",
        name: "read_file",
        args: { path: "src/cli.ts" },
        status: "ok",
      },
      { kind: "user", text: "now run the tests" },
      {
        kind: "tool",
        name: "shell",
        args: { command: "bun test" },
        status: "failed",
      },
    ]);
  });

  test("an assistant turn that only called tools adds no empty line", () => {
    const view = restore(conversation);
    const assistants = view.committed.filter(
      (item) => item.kind === "assistant",
    );

    expect(assistants).toHaveLength(1);
  });

  test("keys are distinct, so the renderer can key off them", () => {
    const keys = restore(conversation).committed.map((item) => item.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  test("a tool entry with no recorded outcome is a malformed session", () => {
    expect(() =>
      restore([
        {
          message: {
            role: "tool",
            content: "whatever",
            name: "shell",
            toolCallId: "x",
          },
        },
      ]),
    ).toThrow("records no outcome");
  });

  test("survives a real save and load", async () => {
    const workspace = await makeWorkspace();
    const session = createSession({
      workspace: workspace.root,
      model: "scripted",
      task: "fix the bug",
      entries: conversation,
    });
    await saveSession(session);

    const view = restore((await loadSession(workspace.root, session.id)).entries);

    expect(view.committed.filter((item) => item.kind === "tool")).toMatchObject([
      { status: "ok" },
      { status: "failed" },
    ]);
  });
});
