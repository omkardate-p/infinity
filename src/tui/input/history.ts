/**
 * Renders a session loaded from disk as transcript items, so resuming shows
 * what happened rather than an empty screen.
 *
 * A tool entry records its own outcome but not the arguments it was called
 * with; those live on the assistant message that requested the call. Pairing
 * them by toolCallId is the whole job here.
 */

import type { TranscriptItem } from "../../domain/messages.ts";
import type { SessionEntry } from "../../harness/agent/state.ts";
import type { ToolCall } from "../../harness/model/types.ts";
import { empty, type ViewModel } from "../state/view-model.ts";

export function restore(entries: SessionEntry[]): ViewModel {
  const items: TranscriptItem[] = [];
  const requested = new Map<string, ToolCall>();
  let key = 0;

  for (const entry of entries) {
    const message = entry.message;

    switch (message.role) {
      // The working contract is not part of the conversation on screen.
      case "system":
        break;

      case "user":
        items.push({ key: key++, kind: "user", text: text(message.content) });
        break;

      case "assistant": {
        for (const call of message.toolCalls ?? [])
          requested.set(call.id, call);
        const body = text(message.content);
        if (body) items.push({ key: key++, kind: "assistant", text: body });
        break;
      }

      case "tool": {
        const call = message.toolCallId
          ? requested.get(message.toolCallId)
          : undefined;
        items.push({
          key: key++,
          kind: "tool",
          id: message.toolCallId ?? "",
          name: message.name ?? call?.name ?? "tool",
          args: call ? call.args : {},
          status: statusOf(entry, message.name),
          content: text(message.content),
        });
        break;
      }
    }
  }

  return { ...empty(), committed: items, nextKey: key };
}

// The loop records the outcome on every tool entry it writes, and a session
// from before that refuses to load on version. Guessing a colour here would
// show a denial as a success.
function statusOf(
  entry: SessionEntry,
  name: string | undefined,
): "ok" | "failed" {
  if (entry.ok === undefined) {
    throw new Error(
      `session entry for ${name ?? "a tool call"} records no outcome`,
    );
  }
  return entry.ok ? "ok" : "failed";
}

function text(content: unknown): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}
