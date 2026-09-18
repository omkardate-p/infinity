/**
 * What a conversation is made of, once the events that produced it have been
 * folded together: one entry per thing a reader sees.
 *
 * These are display items, not the messages a model is sent — those are
 * `Message` in harness/model/types.ts, and the two differ on purpose. A tool
 * call and its result are one item here and two messages there, and a key
 * exists here because a list has to be keyed and means nothing to a provider.
 */

import type { AgentStopReason } from "./events.ts";

export type ToolStatus = "running" | "ok" | "failed";

export type TranscriptItem =
  | { key: number; kind: "elapsed"; ms: number; at: number }
  | {
      key: number;
      kind: "banner";
      model: string;
      workspace: string;
      version: string;
    }
  | { key: number; kind: "user"; text: string }
  | { key: number; kind: "assistant"; text: string }
  | {
      key: number;
      kind: "tool";
      id: string;
      name: string;
      args: unknown;
      status: ToolStatus;
      content: string;
    }
  | { key: number; kind: "error"; message: string }
  | { key: number; kind: "info"; text: string }
  | { key: number; kind: "context"; used: number; window: number }
  | { key: number; kind: "notice"; reason: AgentStopReason; turns: number };
