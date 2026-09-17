import { describe, expect, test } from "bun:test";
import { ToolRegistry, defaultTools } from "../src/tools/registry.ts";
import { ok, type Tool } from "../src/tools/tool.ts";
import { makeWorkspace } from "./helpers.ts";

const echoTool: Tool = {
  name: "echo",
  description: "Echo a message back.",
  inputSchema: {
    type: "object",
    required: ["message"],
    properties: { message: { type: "string" }, count: { type: "integer", minimum: 1 } },
    additionalProperties: false,
  },
  async execute(input) {
    return ok(`echo: ${(input as { message: string }).message}`);
  },
};

describe("ToolRegistry", () => {
  test("rejects an unknown tool and names the ones that exist", async () => {
    const ws = await makeWorkspace();
    const registry = new ToolRegistry([echoTool]);

    const result = await registry.execute("teleport", {}, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.content).toContain('unknown tool "teleport"');
    expect(result.content).toContain("echo");
    expect(result.meta?.reason).toBe("unknown_tool");
  });

  test("rejects arguments that violate the schema", async () => {
    const ws = await makeWorkspace();
    const registry = new ToolRegistry([echoTool]);

    const result = await registry.execute("echo", { count: 0 }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.meta?.reason).toBe("invalid_arguments");
    // Both problems are reported at once rather than one failed turn at a time.
    expect(result.content).toContain("message");
    expect(result.content).toContain("count");
  });

  test("rejects arguments that are not an object at all", async () => {
    const ws = await makeWorkspace();
    const registry = new ToolRegistry([echoTool]);

    const result = await registry.execute("echo", "just a string", ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.meta?.reason).toBe("invalid_arguments");
  });

  test("runs a valid call", async () => {
    const ws = await makeWorkspace();
    const registry = new ToolRegistry([echoTool]);

    const result = await registry.execute("echo", { message: "hi" }, ws.ctx);

    expect(result.ok).toBe(true);
    expect(result.content).toBe("echo: hi");
  });

  test("turns a throwing tool into a structured failure", async () => {
    const ws = await makeWorkspace();
    const registry = new ToolRegistry([
      {
        ...echoTool,
        name: "boom",
        async execute() {
          throw new Error("kaboom");
        },
      },
    ]);

    const result = await registry.execute("boom", { message: "x" }, ws.ctx);

    expect(result.ok).toBe(false);
    expect(result.meta?.reason).toBe("tool_exception");
    expect(result.content).toContain("kaboom");
  });

  test("exposes every default tool to the model with a schema", () => {
    const registry = new ToolRegistry(defaultTools());
    const specs = registry.specs();

    expect(specs.map((spec) => spec.name)).toEqual([
      "list_dir",
      "read_file",
      "search",
      "edit_file",
      "write_file",
      "shell",
    ]);
    for (const spec of specs) {
      expect(spec.description.length).toBeGreaterThan(20);
      expect(spec.inputSchema.type).toBe("object");
    }
  });

  test("refuses to register the same tool name twice", () => {
    const registry = new ToolRegistry([echoTool]);
    expect(() => registry.register(echoTool)).toThrow("already registered");
  });
});
