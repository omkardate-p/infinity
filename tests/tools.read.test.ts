/**
 * The read-only tools, and the workspace boundary they share: traversal,
 * absolute paths and symlinks all have to be refused.
 */

import { describe, expect, test } from "bun:test";
import { listDir } from "../src/tools/list-dir.ts";
import { readFileTool } from "../src/tools/read-file.ts";
import { makeWorkspace } from "./helpers.ts";

describe("list_dir", () => {
  test("lists entries with directories first and marked", async () => {
    const ws = await makeWorkspace();
    await ws.write("src/index.ts", "export {};\n");
    await ws.write("package.json", "{}\n");

    const result = await listDir.execute({ path: "." }, ws.ctx);

    expect(result.ok).toBe(true);
    expect(result.content).toContain("src/");
    expect(result.content).toContain("package.json");
    expect(result.content.indexOf("src/")).toBeLessThan(
      result.content.indexOf("package.json"),
    );
  });

  test("defaults to the workspace root", async () => {
    const ws = await makeWorkspace();
    await ws.write("only.txt", "x\n");

    const result = await listDir.execute({}, ws.ctx);

    expect(result.ok).toBe(true);
    expect(result.content).toContain("only.txt");
  });

  test("omits generated directories from a listing", async () => {
    const ws = await makeWorkspace();
    await ws.write("node_modules/left-pad/index.js", "module.exports = 1;\n");
    await ws.write("app.ts", "export {};\n");

    const result = await listDir.execute({ path: "." }, ws.ctx);

    expect(result.content).not.toContain("node_modules/\n");
    expect(result.content).toContain("app.ts");
  });

  test("rejects a path outside the workspace", async () => {
    const ws = await makeWorkspace();

    const result = await listDir.execute({ path: "../.." }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.content).toContain("outside the workspace");
  });

  test("points at read_file when given a file", async () => {
    const ws = await makeWorkspace();
    await ws.write("a.txt", "hello\n");

    const result = await listDir.execute({ path: "a.txt" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.content).toContain("read_file");
  });
});

describe("read_file", () => {
  test("returns numbered lines", async () => {
    const ws = await makeWorkspace();
    await ws.write("a.txt", "first\nsecond\n");

    const result = await readFileTool.execute({ path: "a.txt" }, ws.ctx);

    expect(result.ok).toBe(true);
    expect(result.content).toContain("1\tfirst");
    expect(result.content).toContain("2\tsecond");
    expect(result.meta?.totalLines).toBe(2);
  });

  test("reads a window and says where to continue", async () => {
    const ws = await makeWorkspace();
    await ws.write(
      "many.txt",
      Array.from({ length: 50 }, (_, i) => `line ${i + 1}`).join("\n"),
    );

    const result = await readFileTool.execute(
      { path: "many.txt", start_line: 10, max_lines: 5 },
      ws.ctx,
    );

    expect(result.ok).toBe(true);
    expect(result.content).toContain("10\tline 10");
    expect(result.content).toContain("14\tline 14");
    expect(result.content).not.toContain("15\tline 15");
    expect(result.content).toContain("start_line 15");
  });

  test("rejects an absolute path outside the workspace", async () => {
    const ws = await makeWorkspace();

    const result = await readFileTool.execute({ path: "/etc/passwd" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.content).toContain("outside the workspace");
  });

  test("rejects a traversal path outside the workspace", async () => {
    const ws = await makeWorkspace();

    const result = await readFileTool.execute(
      { path: "../../../etc/hosts" },
      ws.ctx,
    );

    expect(result.ok).toBe(false);
    expect(result.content).toContain("outside the workspace");
  });

  test("refuses to follow a symlink pointing out of the workspace", async () => {
    const ws = await makeWorkspace();
    const { symlink } = await import("node:fs/promises");
    await symlink("/etc/hosts", `${ws.root}/escape.txt`);

    const result = await readFileTool.execute({ path: "escape.txt" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.content).toContain("outside the workspace");
  });

  test("reports a missing file rather than throwing", async () => {
    const ws = await makeWorkspace();

    const result = await readFileTool.execute({ path: "nope.txt" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.content).toContain("no such file");
  });
});
