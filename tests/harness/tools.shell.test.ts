/**
 * shell: exit codes, captured output, truncation, the timeout kill, abort, and
 * the fact that a denied command does not run.
 */

import { describe, expect, test } from "bun:test";
import { shell } from "../../src/harness/tools/shell.ts";
import { makeWorkspace } from "../helpers.ts";

describe("shell", () => {
  test("captures stdout and a zero exit code", async () => {
    const ws = await makeWorkspace();

    const result = await shell.execute({ command: "echo hello" }, ws.ctx);

    expect(result.ok).toBe(true);
    expect(result.content).toContain("exit code: 0");
    expect(result.content).toContain("hello");
  });

  test("reports a non-zero exit code as a failed result", async () => {
    const ws = await makeWorkspace();

    const result = await shell.execute({ command: "exit 3" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.meta?.exitCode).toBe(3);
  });

  test("captures stderr", async () => {
    const ws = await makeWorkspace();

    const result = await shell.execute(
      { command: "echo oops 1>&2; exit 1" },
      ws.ctx,
    );

    expect(result.content).toContain("stderr:");
    expect(result.content).toContain("oops");
  });

  test("runs with cwd inside the workspace", async () => {
    const ws = await makeWorkspace();
    await ws.write("marker.txt", "x\n");

    const result = await shell.execute({ command: "ls" }, ws.ctx);

    expect(result.content).toContain("marker.txt");
  });

  test("kills a command that exceeds its timeout", async () => {
    const ws = await makeWorkspace();

    const started = Date.now();
    const result = await shell.execute(
      { command: "sleep 30", timeout_ms: 1000 },
      ws.ctx,
    );

    expect(result.ok).toBe(false);
    expect(result.meta?.reason).toBe("timeout");
    expect(result.content).toContain("timed out");
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  test("truncates oversized output and says so", async () => {
    const ws = await makeWorkspace();

    const result = await shell.execute(
      {
        command:
          "for i in $(seq 1 6000); do echo 'a line of output padding padding padding'; done",
      },
      ws.ctx,
    );

    expect(result.truncated).toBe(true);
    expect(result.content).toContain("bytes omitted");
  });

  test("does not execute when approval is denied", async () => {
    const ws = await makeWorkspace({ approval: "deny" });

    const result = await shell.execute(
      { command: "touch should-not-exist.txt" },
      ws.ctx,
    );

    expect(result.ok).toBe(false);
    expect(result.meta?.reason).toBe("denied");
    expect(await Bun.file(`${ws.root}/should-not-exist.txt`).exists()).toBe(
      false,
    );
  });

  test("stops a running command when the session is aborted", async () => {
    const controller = new AbortController();
    const ws = await makeWorkspace({ signal: controller.signal });

    const running = shell.execute({ command: "sleep 30" }, ws.ctx);
    setTimeout(() => controller.abort(), 300);
    const result = await running;

    expect(result.ok).toBe(false);
    expect(result.meta?.reason).toBe("aborted");
  });

  test("rejects a cwd outside the workspace without asking for approval", async () => {
    const ws = await makeWorkspace();

    const result = await shell.execute({ command: "ls", cwd: "/etc" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.content).toContain("outside the workspace");
    expect(ws.approvals).toHaveLength(0);
  });

  test("asks for approval with the exact command line", async () => {
    const ws = await makeWorkspace();

    await shell.execute({ command: "echo audited" }, ws.ctx);

    expect(ws.approvals[0]?.tool).toBe("shell");
    expect(ws.approvals[0]?.summary).toBe("echo audited");
  });
});
