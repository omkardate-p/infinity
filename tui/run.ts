/**
 * Mounts the TUI. The caller has already parsed arguments and built the model,
 * so nothing here duplicates the command line.
 *
 * Ink is told not to patch console: the CLI writes to stdout on the line-mode
 * path, and a stray write would clear and redraw the whole frame. The
 * alternate screen stays off so that finished transcript items land in the
 * terminal's own scrollback.
 *
 * A terminal sends the same byte for Enter and Shift+Enter unless the kitty
 * keyboard protocol is negotiated, which is what lets the composer tell a
 * newline from a submit. Auto mode queries the terminal first and stays off
 * where there is no answer.
 */

import { stdout } from "node:process";
import { render, renderToString } from "ink";
import { createElement } from "react";
import type { SessionState } from "../src/agent/state.ts";
import type { Model } from "../src/model/types.ts";
import type { ToolRegistry } from "../src/tools/registry.ts";
import { App } from "./app.tsx";
import { Banner } from "./status.tsx";

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
  // Written once, before Ink takes over. Inside the render tree it would sit in
  // the live frame, which <Static> writes above, and sink under the transcript.
  stdout.write(
    renderToString(
      createElement(Banner, {
        model: options.model.id,
        workspace: options.workspace,
        version: options.version,
      }),
    ) + "\n",
  );

  const { version: _banner, ...appProps } = options;
  const app = render(createElement(App, appProps), {
    patchConsole: false,
    alternateScreen: false,
    exitOnCtrlC: false,
    kittyKeyboard: { mode: "auto", flags: ["disambiguateEscapeCodes"] },
  });

  await app.waitUntilExit();
  return 0;
}
