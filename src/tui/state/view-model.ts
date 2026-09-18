/**
 * Turns the agent's event stream into transcript items. Pure: no React, no
 * terminal, no agent. An item is either committed, meaning the terminal's own
 * scrollback holds it and it can never be redrawn, or live, meaning it is still
 * changing.
 * Nothing is committed until it is final, which is why this file is separate
 * from the components that render it.
 */

import type { AgentEvent, AgentStopReason } from "../../domain/events.ts";
import type { TranscriptItem } from "../../domain/messages.ts";

export interface ViewModel {
  committed: TranscriptItem[];
  // At most one item is ever unfinished: text_delta opens an assistant item,
  // tool_start commits it and opens a tool item, tool_end commits that.
  live: TranscriptItem | undefined;
  turn: number;
  running: boolean;
  nextKey: number;
}

export function empty(): ViewModel {
  return {
    committed: [],
    live: undefined,
    turn: 0,
    running: false,
    nextKey: 0,
  };
}

export function withBanner(
  state: ViewModel,
  banner: { model: string; workspace: string; version: string },
): ViewModel {
  return {
    ...state,
    committed: [
      { key: state.nextKey, kind: "banner", ...banner },
      ...state.committed,
    ],
    nextKey: state.nextKey + 1,
  };
}

export function commitUser(state: ViewModel, text: string): ViewModel {
  return {
    ...state,
    committed: [...state.committed, { key: state.nextKey, kind: "user", text }],
    nextKey: state.nextKey + 1,
    running: true,
  };
}

// How long the exchange took, written under it. This is what separates one
// exchange from the next; the caller owns the clock, so this stays pure.
export function commitElapsed(
  state: ViewModel,
  ms: number,
  at: number,
): ViewModel {
  return {
    ...state,
    committed: [
      ...state.committed,
      { key: state.nextKey, kind: "elapsed", ms, at },
    ],
    nextKey: state.nextKey + 1,
  };
}

export function reduce(state: ViewModel, event: AgentEvent): ViewModel {
  switch (event.type) {
    case "turn_start":
      return { ...state, turn: event.turn, running: true };

    // The spinner animates on its own timer, so reasoning drives nothing.
    case "thinking_delta":
      return state;

    case "text_delta": {
      const live = state.live;
      if (live?.kind === "assistant") {
        return { ...state, live: { ...live, text: live.text + event.text } };
      }
      return {
        ...state,
        live: { key: state.nextKey, kind: "assistant", text: event.text },
        nextKey: state.nextKey + 1,
      };
    }

    case "tool_start": {
      const committed = commitLive(state);
      return {
        ...state,
        committed,
        live: {
          key: state.nextKey,
          kind: "tool",
          id: event.id,
          name: event.name,
          args: event.args,
          status: "running",
          content: "",
        },
        nextKey: state.nextKey + 1,
      };
    }

    case "tool_end": {
      const live = state.live;
      // Both providers emit every tool_call only after the stream loop ends, so
      // the loop yields tool_start and tool_end in pairs with a matching id.
      // Ignoring a mismatch here would silently drop a tool result.
      if (live?.kind !== "tool" || live.id !== event.id) {
        throw new Error(
          `tool_end ${event.id} arrived with no matching open tool call`,
        );
      }
      return {
        ...state,
        committed: [
          ...state.committed,
          {
            ...live,
            status: event.ok ? "ok" : "failed",
            content: event.content,
          },
        ],
        live: undefined,
      };
    }

    case "error":
      return {
        ...state,
        committed: [
          ...commitLive(state),
          { key: state.nextKey, kind: "error", message: event.error.message },
        ],
        live: undefined,
        nextKey: state.nextKey + 1,
      };

    case "done": {
      const committed = commitLive(state);
      if (!explains(event.reason)) {
        return { ...state, committed, live: undefined, running: false };
      }
      return {
        ...state,
        committed: [
          ...committed,
          {
            key: state.nextKey,
            kind: "notice",
            reason: event.reason,
            turns: event.turns,
          },
        ],
        live: undefined,
        nextKey: state.nextKey + 1,
        running: false,
      };
    }
  }
}

function commitLive(state: ViewModel): TranscriptItem[] {
  return state.live ? [...state.committed, state.live] : state.committed;
}

// A run that simply finished needs no line, and a model error already printed
// one. The rest stopped for a reason nothing else in the transcript states.
function explains(reason: AgentStopReason): boolean {
  return (
    reason === "max_turns" || reason === "aborted" || reason === "denial_limit"
  );
}
