/**
 * The commands the menu offers, in the order it offers them, and how a typed
 * query is turned into matches. Pure: it reads text and returns commands, so
 * the filtering is tested without a terminal.
 */

import { clear } from "./clear.ts";
import type { Command } from "./command.ts";
import { exit } from "./exit.ts";
import { help } from "./help.ts";
import { model } from "./model.ts";
import { resume } from "./resume.ts";
import { sessions } from "./sessions.ts";

export function defaultCommands(): Command[] {
  return [help, clear, sessions, resume, model, exit];
}

export interface CommandMatch {
  command: Command;
  // Where the query landed in `/name`, so the menu need not search it again.
  start: number;
  end: number;
}

// The menu's query is what follows the slash while the buffer is still one
// word. A space settles the name and makes the rest an argument.
export function commandQuery(text: string): string | undefined {
  if (!text.startsWith("/")) return undefined;
  const query = text.slice(1);
  return /\s/.test(query) ? undefined : query;
}

export function parseCommand(text: string): { name: string; args: string } {
  const body = text.slice(1).trim();
  const space = body.search(/\s/);
  if (space === -1) return { name: body, args: "" };
  return { name: body.slice(0, space), args: body.slice(space + 1).trim() };
}

// Substring rather than prefix: a command is as often remembered by what it
// does as by what it starts with. Names that match at the front come first.
export function matchCommands(
  commands: Command[],
  query: string,
): CommandMatch[] {
  const needle = query.toLowerCase();
  const matches: CommandMatch[] = [];

  for (const command of commands) {
    const at = command.name.toLowerCase().indexOf(needle);
    if (at === -1) continue;
    // Offsets into `/name`, which is what the menu draws.
    matches.push({ command, start: at + 1, end: at + 1 + needle.length });
  }

  return matches.sort((a, b) => a.start - b.start);
}
