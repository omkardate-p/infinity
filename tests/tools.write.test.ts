import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { editFile } from "../src/tools/edit-file.ts";
import { writeFileTool } from "../src/tools/write-file.ts";
import { makeWorkspace } from "./helpers.ts";

describe("edit_file", () => {
  test("replaces a unique match and reports the line", async () => {
    const ws = await makeWorkspace();
    await ws.write("a.ts", "const a = 1;\nconst b = 2;\n");

    const result = await editFile.execute({ path: "a.ts", old_text: "const b = 2;", new_text: "const b = 3;" }, ws.ctx);

    expect(result.ok).toBe(true);
    expect(await readFile(join(ws.root, "a.ts"), "utf8")).toBe("const a = 1;\nconst b = 3;\n");
    expect(result.meta?.line).toBe(2);
  });

  test("refuses an ambiguous match and leaves the file alone", async () => {
    const ws = await makeWorkspace();
    const original = "call();\ncall();\n";
    await ws.write("a.ts", original);

    const result = await editFile.execute({ path: "a.ts", old_text: "call();", new_text: "call(1);" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.content).toContain("ambiguous");
    expect(result.meta?.occurrences).toBe(2);
    expect(await readFile(join(ws.root, "a.ts"), "utf8")).toBe(original);
  });

  test("fails when old_text is absent", async () => {
    const ws = await makeWorkspace();
    await ws.write("a.ts", "const a = 1;\n");

    const result = await editFile.execute({ path: "a.ts", old_text: "const zzz = 9;", new_text: "x" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.content).toContain("not found");
  });

  test("asks for approval before editing", async () => {
    const ws = await makeWorkspace();
    await ws.write("a.ts", "const a = 1;\n");

    await editFile.execute({ path: "a.ts", old_text: "const a = 1;", new_text: "const a = 2;" }, ws.ctx);

    expect(ws.approvals).toHaveLength(1);
    expect(ws.approvals[0]?.tool).toBe("edit_file");
    expect(ws.approvals[0]?.detail).toContain("- const a = 1;");
    expect(ws.approvals[0]?.detail).toContain("+ const a = 2;");
  });

  test("does not edit when approval is denied", async () => {
    const ws = await makeWorkspace({ approval: "deny" });
    await ws.write("a.ts", "const a = 1;\n");

    const result = await editFile.execute({ path: "a.ts", old_text: "1", new_text: "2" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.meta?.reason).toBe("denied");
    expect(await readFile(join(ws.root, "a.ts"), "utf8")).toBe("const a = 1;\n");
  });

  test("rejects a path outside the workspace before reading it", async () => {
    const ws = await makeWorkspace();

    const result = await editFile.execute({ path: "/etc/hosts", old_text: "localhost", new_text: "evil" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.content).toContain("outside the workspace");
    expect(ws.approvals).toHaveLength(0);
  });
});

describe("write_file", () => {
  test("creates a file, including missing parent directories", async () => {
    const ws = await makeWorkspace();

    const result = await writeFileTool.execute({ path: "src/new/a.ts", content: "export {};\n" }, ws.ctx);

    expect(result.ok).toBe(true);
    expect(result.meta?.created).toBe(true);
    expect(await readFile(join(ws.root, "src/new/a.ts"), "utf8")).toBe("export {};\n");
  });

  test("labels an overwrite distinctly in the approval request", async () => {
    const ws = await makeWorkspace();
    await ws.write("a.ts", "old\n");

    await writeFileTool.execute({ path: "a.ts", content: "new\n" }, ws.ctx);

    expect(ws.approvals[0]?.summary).toContain("overwrite");
  });

  test("does not write when approval is denied", async () => {
    const ws = await makeWorkspace({ approval: "deny" });

    const result = await writeFileTool.execute({ path: "a.ts", content: "x\n" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.meta?.reason).toBe("denied");
    expect(readFile(join(ws.root, "a.ts"), "utf8")).rejects.toThrow();
  });

  test("rejects writing outside the workspace without asking for approval", async () => {
    const ws = await makeWorkspace();

    const result = await writeFileTool.execute({ path: "../escaped.txt", content: "x" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.content).toContain("outside the workspace");
    expect(ws.approvals).toHaveLength(0);
  });
});
