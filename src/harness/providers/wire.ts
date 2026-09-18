/**
 * What both HTTP adapters do identically: turning a value into the string a
 * chat endpoint accepts, describing a tool, and telling an abort apart from a
 * failure. Nothing here belongs to one wire format; a field or a frame that
 * only one endpoint sends stays in that provider's own file.
 */

import type { ToolSpec } from "../model/types.ts";

export function stringifyContent(content: unknown): string {
  if (content === null || content === undefined) return "";
  if (typeof content === "string") return content;
  return JSON.stringify(content);
}

export function toWireTool(tool: ToolSpec) {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

export function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function asError(error: unknown, context: string): Error {
  if (error instanceof Error) return new Error(`${context}: ${error.message}`);
  return new Error(`${context}: ${String(error)}`);
}

export async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}
