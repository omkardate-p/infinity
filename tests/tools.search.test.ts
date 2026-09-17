import { describe, expect, test } from "bun:test";
import { search } from "../src/tools/search.ts";
import { makeWorkspace } from "./helpers.ts";

describe("search", () => {
  test("returns matches as relative path, line number and text", async () => {
    const ws = await makeWorkspace();
    await ws.write("src/app.ts", "export function greet() {\n  return 'hi';\n}\n");

    const result = await search.execute({ pattern: "greet" }, ws.ctx);

    expect(result.ok).toBe(true);
    expect(result.content).toContain("src/app.ts:1:");
    expect(result.content).not.toContain(ws.root);
  });

  test("reports no matches without failing", async () => {
    const ws = await makeWorkspace();
    await ws.write("a.ts", "const x = 1;\n");

    const result = await search.execute({ pattern: "zzzznotfound" }, ws.ctx);

    expect(result.ok).toBe(true);
    expect(result.content).toContain("No matches");
    expect(result.meta?.matches).toBe(0);
  });

  test("honours a glob", async () => {
    const ws = await makeWorkspace();
    await ws.write("a.ts", "target\n");
    await ws.write("b.md", "target\n");

    const result = await search.execute({ pattern: "target", glob: "*.ts" }, ws.ctx);

    expect(result.content).toContain("a.ts");
    expect(result.content).not.toContain("b.md");
  });

  test("caps the number of returned matches", async () => {
    const ws = await makeWorkspace();
    for (let file = 0; file < 12; file++) {
      await ws.write(`f${file}.ts`, Array.from({ length: 10 }, () => "needle").join("\n"));
    }

    const result = await search.execute({ pattern: "needle", max_results: 5 }, ws.ctx);

    expect(result.ok).toBe(true);
    expect(result.meta?.returned).toBe(5);
    expect(result.meta?.matches).toBe(120);
    expect(result.content).toContain("115 more matching lines");
  });

  test("rejects searching outside the workspace", async () => {
    const ws = await makeWorkspace();

    const result = await search.execute({ pattern: "root", path: "/etc" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.content).toContain("outside the workspace");
  });
});
