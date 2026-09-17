/**
 * Session persistence. A session is the conversation plus enough metadata to
 * tell whether resuming it is safe: which workspace it ran in and which model
 * produced it. Sessions live inside the workspace so that they travel with the
 * repository they describe.
 */

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Message } from "../model/types.ts";

const SESSION_DIR = ".infinity/sessions";
const FORMAT_VERSION = 2;

/**
 * A message plus what the loop knew about it and the model does not see. The
 * flag cannot live on Message: that file is the provider boundary and no
 * provider emits it.
 */
export interface SessionEntry {
  message: Message;
  // Present on tool entries: whether the call succeeded.
  ok?: boolean;
}

export interface SessionState {
  version: number;
  id: string;
  workspace: string;
  model: string;
  task: string;
  createdAt: string;
  updatedAt: string;
  entries: SessionEntry[];
  // Lifetime total, carried across a resume.
  turns: number;
}

export function messagesOf(session: SessionState): Message[] {
  return session.entries.map((entry) => entry.message);
}

export function newSessionId(): string {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+/, "");
  return `${stamp}-${Math.random().toString(36).slice(2, 8)}`;
}

export function sessionPath(workspace: string, id: string): string {
  return join(workspace, SESSION_DIR, `${id}.json`);
}

export async function saveSession(state: SessionState): Promise<void> {
  const path = sessionPath(state.workspace, state.id);
  await mkdir(join(state.workspace, SESSION_DIR), { recursive: true });
  const serialized: SessionState = {
    ...state,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(path, `${JSON.stringify(serialized, null, 2)}\n`, "utf8");
}

export async function loadSession(
  workspace: string,
  id: string,
): Promise<SessionState> {
  let raw: string;
  try {
    raw = await readFile(sessionPath(workspace, id), "utf8");
  } catch {
    throw new Error(`No session ${id} in ${join(workspace, SESSION_DIR)}`);
  }

  const parsed = JSON.parse(raw) as SessionState;
  if (parsed.version !== FORMAT_VERSION) {
    throw new Error(
      `Session ${id} is format version ${parsed.version}; this build reads version ${FORMAT_VERSION}.`,
    );
  }
  if (parsed.workspace !== workspace) {
    // Resuming a session against a different tree would replay tool results
    // that describe files this workspace does not have.
    throw new Error(
      `Session ${id} was recorded in ${parsed.workspace}, not ${workspace}. Resume it there.`,
    );
  }
  return parsed;
}

// Newest first.
export async function listSessions(workspace: string): Promise<string[]> {
  try {
    const files = await readdir(join(workspace, SESSION_DIR));
    return files
      .filter((file) => file.endsWith(".json"))
      .map((file) => file.slice(0, -".json".length))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function createSession(input: {
  workspace: string;
  model: string;
  task: string;
  entries: SessionEntry[];
}): SessionState {
  const now = new Date().toISOString();
  return {
    version: FORMAT_VERSION,
    id: newSessionId(),
    workspace: input.workspace,
    model: input.model,
    task: input.task,
    createdAt: now,
    updatedAt: now,
    entries: input.entries,
    turns: 0,
  };
}
