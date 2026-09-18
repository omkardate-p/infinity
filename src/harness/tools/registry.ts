/**
 * Holds the tools available to the model, validates model-supplied input
 * against each tool's schema, and executes calls. The agent loop goes through
 * this file rather than touching a Tool directly, so that an unknown tool name
 * or a malformed argument object is a structured result rather than a crash.
 */

import Ajv, { type ValidateFunction } from "ajv";
import type { ToolSpec } from "../model/types.ts";
import { editFile } from "./edit-file.ts";
import { listDir } from "./list-dir.ts";
import { readFileTool } from "./read-file.ts";
import { search } from "./search.ts";
import { shell } from "./shell.ts";
import { fail, type Tool, type ToolContext, type ToolResult } from "./tool.ts";
import { writeFileTool } from "./write-file.ts";

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>();
  private readonly validators = new Map<string, ValidateFunction>();
  private readonly ajv: Ajv;

  constructor(tools: Tool[] = []) {
    // allErrors so the model is told about every bad argument at once rather
    // than discovering them one failed turn at a time.
    this.ajv = new Ajv({ allErrors: true, strict: false });
    for (const tool of tools) this.register(tool);
  }

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    this.validators.set(tool.name, this.ajv.compile(tool.inputSchema));
  }

  specs(): ToolSpec[] {
    return [...this.tools.values()].map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  async execute(
    name: string,
    input: unknown,
    ctx: ToolContext,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      const known = [...this.tools.keys()].join(", ");
      return fail(`unknown tool "${name}". Available tools: ${known}`, {
        reason: "unknown_tool",
      });
    }

    const validate = this.validators.get(name)!;
    if (!validate(input)) {
      const problems = (validate.errors ?? [])
        .map((error) => `${error.instancePath || "input"} ${error.message}`)
        .join("; ");
      return fail(`invalid arguments for ${name}: ${problems}`, {
        reason: "invalid_arguments",
        tool: name,
      });
    }

    try {
      return await tool.execute(input, ctx);
    } catch (error) {
      // A tool that throws is a bug in the tool, but the loop must survive it.
      const message = error instanceof Error ? error.message : String(error);
      return fail(`${name} failed unexpectedly: ${message}`, {
        reason: "tool_exception",
        tool: name,
      });
    }
  }
}

// Read-only tools first, so a model scanning the list meets inspection before
// mutation.
export function defaultTools(): Tool[] {
  return [listDir, readFileTool, search, editFile, writeFileTool, shell];
}
