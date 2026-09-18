#!/usr/bin/env bun
/**
 * Reports what this terminal actually sends for a key, under each keyboard
 * protocol mode in turn. It deliberately does not use Ink: the question is
 * what the terminal emits, separate from what any parser makes of it.
 *
 * Run it, follow the prompts, and paste the output back.
 */

import { stdin, stdout } from "node:process";

interface Mode {
  name: string;
  enable: string;
  reset: string;
}

const MODES: Mode[] = [
  { name: "baseline (nothing enabled)", enable: "", reset: "" },
  {
    name: "kitty: disambiguateEscapeCodes",
    enable: "[>1u",
    reset: "[<u",
  },
  {
    name: "kitty: disambiguate + reportAllKeysAsEscapeCodes",
    enable: "[>9u",
    reset: "[<u",
  },
  {
    name: "kitty: the three flags together",
    enable: "[>25u",
    reset: "[<u",
  },
  {
    name: "xterm modifyOtherKeys level 2",
    enable: "[>4;2m",
    reset: "[>4n",
  },
  {
    name: "xterm modifyOtherKeys level 2, CSI u format",
    enable: "[>4;2m[>4;1f",
    reset: "[>4n",
  },
];

const KEYS = ["a", "Enter", "Shift+Enter"];

function describe(data: Buffer): string {
  const hex = [...data].map((b) => b.toString(16).padStart(2, "0")).join(" ");
  const printable = [...data]
    .map((b) =>
      b === 0x1b
        ? "ESC"
        : b < 0x20
          ? `\\x${b.toString(16)}`
          : String.fromCharCode(b),
    )
    .join("");
  return `${printable.padEnd(24)}  bytes: ${hex}`;
}

function nextKey(): Promise<Buffer> {
  return new Promise((resolve) => {
    const onData = (data: Buffer) => {
      stdin.removeListener("data", onData);
      resolve(data);
    };
    stdin.on("data", onData);
  });
}

// Every exit path restores the terminal: a session left in raw mode or still
// re-encoding keys is worse than no answer.
let active: Mode | undefined;
function restore(): void {
  if (active) stdout.write(active.reset);
  active = undefined;
  if (stdin.isTTY) stdin.setRawMode(false);
}
process.on("exit", restore);

if (!stdin.isTTY) {
  console.error("Run this from a terminal; it has to ask the terminal itself.");
  process.exit(2);
}

stdin.setRawMode(true);
stdin.resume();

stdout.write(`terminal: ${process.env["TERM_PROGRAM"] ?? "unknown"}`);
stdout.write(` ${process.env["TERM_PROGRAM_VERSION"] ?? ""}\r\n`);
stdout.write("Press the key named on each line. Ctrl-C quits.\r\n\r\n");

for (const mode of MODES) {
  stdout.write(`${mode.name}\r\n`);
  active = mode;
  if (mode.enable) stdout.write(mode.enable);

  for (const key of KEYS) {
    stdout.write(`  press ${key.padEnd(12)} `);
    const data = await nextKey();
    if (data.length === 1 && data[0] === 3) {
      stdout.write("\r\n");
      process.exit(0);
    }
    stdout.write(`${describe(data)}\r\n`);
  }

  if (mode.reset) stdout.write(mode.reset);
  active = undefined;
  stdout.write("\r\n");
}

stdout.write("done\r\n");
process.exit(0);
