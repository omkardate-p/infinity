/**
 * Mounts the TUI. The caller has already parsed arguments and built the model,
 * so nothing here duplicates the command line.
 *
 * split-footer keeps the transcript in the terminal's own scrollback, so it can
 * be scrolled, searched and copied the way any command's output can, while the
 * composer and the status line are redrawn in a pinned footer.
 *
 * The kitty keyboard protocol is what makes Shift+Enter distinguishable from
 * Enter: it arrives as CSI 13;2u, measured against iTerm2 3.7.1 with
 * src/tui/input/keyprobe.ts. The renderer asks for disambiguateEscapeCodes and
 * alternateKeys by default, which is what this wants. The two flags measured as
 * harmful are the other ones: reportAllKeysAsEscapeCodes makes Shift+Enter
 * report the shift key itself, and reportAssociatedText makes an ordinary key
 * arrive with an empty modifier field that the key matcher rejects.
 */

import { stdout } from "node:process";
import { type CliRenderer, createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createElement } from "react";
import type { SessionState } from "../harness/agent/state.ts";
import type { Model } from "../harness/model/types.ts";
import type { ToolRegistry } from "../harness/tools/registry.ts";
import { App } from "./app.tsx";

const FOOTER_HEIGHT = 8;

// The terminal reports window focus as CSI I and CSI O once asked. OpenTUI
// parses both but never turns the reporting on, so without this the composer
// cannot tell whether anyone is looking at it and its cursor blinks on into an
// unfocused window.
const ENABLE_FOCUS_REPORTING = "[?1004h";
const DISABLE_FOCUS_REPORTING = "[?1004l";

// Every signal that would otherwise end the process while the terminal is still
// in raw mode, with a reserved footer and focus reporting left on.
const SIGNALS = ["SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"] as const;

export interface TuiOptions {
  model: Model;
  registry: ToolRegistry;
  workspace: string;
  version: string;
  maxTurns: number | undefined;
  resumed: SessionState | undefined;
  initialTask: string | undefined;
  autoApprove: boolean;
}

export async function runTui(options: TuiOptions): Promise<number> {
  stdout.write(ENABLE_FOCUS_REPORTING);

  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    screenMode: "split-footer",
    footerHeight: FOOTER_HEIGHT,
    // Required for writeToScrollback: the renderer owns stdout so that a
    // committed snapshot and the footer cannot interleave.
    externalOutputMode: "capture-stdout",
    // Leaving wipes the screen otherwise, taking the transcript with it. The
    // conversation belongs in the scrollback after the program ends, the way
    // any other command's output does.
    clearOnShutdown: false,
    // With mouse tracking on, the terminal hands wheel events to this program
    // instead of scrolling its own scrollback, so the transcript cannot be
    // scrolled at all. Nothing here wants the mouse.
    useMouse: false,
  });

  const restore = restorer(renderer);
  process.on("exit", restore);

  return new Promise<number>((resolve) => {
    const finish = (): void => {
      restore();
      resolve(0);
    };
    for (const signal of SIGNALS) process.on(signal, finish);
    createRoot(renderer).render(
      createElement(App, { ...options, onExit: finish }),
    );
  });
}

/**
 * Puts the terminal back, once however many times it is called. A signal
 * handler and the exit handler both run on the way out of a Ctrl-C, and
 * destroy() a second time is not free.
 */
function restorer(renderer: CliRenderer): () => void {
  let done = false;
  return () => {
    if (done) return;
    done = true;
    renderer.destroy();
    stdout.write(DISABLE_FOCUS_REPORTING);
  };
}
