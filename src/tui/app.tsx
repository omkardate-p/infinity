/**
 * The root. It owns the transcript state, the composer buffer and the one
 * approval a tool can be waiting on, and it drives the agent.
 *
 * Finished items are written into the terminal's scrollback and are never
 * redrawn; only the footer re-renders. A snapshot is laid out at the width in
 * force when it was written, so a resize replays the whole transcript at the
 * new width rather than leaving it frozen at the old one.
 *
 * Every tool call the agent makes is awaited in sequence, so exactly one
 * approval is ever outstanding and no request needs correlating back to a call.
 */

import { TextAttributes } from "@opentui/core";
import {
  useKeyboard,
  useOnResize,
  useRenderer,
  useTerminalDimensions,
} from "@opentui/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Agent } from "../harness/agent/agent.ts";
import type { SessionState } from "../harness/agent/state.ts";
import type { Model } from "../harness/model/types.ts";
import type { ToolRegistry } from "../harness/tools/registry.ts";
import type {
  ApprovalDecision,
  ApprovalRequest,
} from "../harness/tools/tool.ts";
import type { CommandContext } from "./commands/command.ts";
import {
  type CommandMatch,
  commandQuery,
  defaultCommands,
  matchCommands,
  parseCommand,
} from "./commands/registry.ts";
import { Approval } from "./components/approval.tsx";
import { Composer } from "./components/composer.tsx";
import { Menu } from "./components/menu.tsx";
import { Spinner, StatusLine } from "./components/status.tsx";
import { type Buffer, emptyBuffer } from "./input/editor.ts";
import { restore } from "./input/history.ts";
import { opaque, padLine } from "./rendering/format.ts";
import {
  composerRows,
  footerPlan,
  itemLines,
  type MenuEntry,
  menuRows,
  opaqueLines,
  promptLines,
  styledText,
} from "./rendering/lines.ts";
import { commitLines, replay } from "./rendering/scrollback.ts";
import {
  commitElapsed,
  commitInfo,
  commitUser,
  empty,
  reduce,
  type ViewModel,
  withBanner,
} from "./state/view-model.ts";

// Prompts accepted while a turn is running, before the composer refuses.
const MAX_QUEUED = 5;

interface Pending {
  request: ApprovalRequest;
  resolve(decision: ApprovalDecision): void;
}

export function App({
  model: startingModel,
  createModel,
  registry,
  workspace,
  version,
  maxTurns,
  resumed,
  initialTask,
  autoApprove,
  onExit,
}: {
  model: Model;
  // Resolves a model name for /model. The caller owns the provider, so the
  // interface still never learns which one is behind a name.
  createModel(name: string): Model;
  registry: ToolRegistry;
  workspace: string;
  version: string;
  maxTurns: number | undefined;
  resumed: SessionState | undefined;
  initialTask: string | undefined;
  autoApprove: boolean;
  // Puts the terminal back and ends the run; the caller exits the process.
  onExit(): void;
}) {
  const renderer = useRenderer();
  const { width } = useTerminalDimensions();

  // One column short of the terminal. A line laid out to exactly the width
  // measures its own height wrongly once it holds a wide glyph, and the rows
  // after it are not drawn at all.
  const usable = width - 1;

  const [model, setModel] = useState(startingModel);
  const [view, setView] = useState<ViewModel>(() =>
    withBanner(
      resumed ? { ...restore(resumed.entries), turn: resumed.turns } : empty(),
      { model: startingModel.id, workspace, version },
    ),
  );
  const [buffer, setBuffer] = useState<Buffer>(emptyBuffer);
  const [selected, setSelected] = useState(0);
  // Escape closes the menu without clearing what was typed, so it stays shut
  // until the query changes.
  const [dismissed, setDismissed] = useState(false);
  const [pending, setPending] = useState<Pending | undefined>(undefined);
  const [since, setSince] = useState(0);
  const [exitHint, setExitHint] = useState(false);
  const [queued, setQueued] = useState<string[]>([]);
  // Not useTerminalDimensions().height: under split-footer that is the footer's
  // own region, so the footer would be sized against itself.
  const [screenHeight, setScreenHeight] = useState(renderer.terminalHeight);

  const sessionRef = useRef<SessionState | undefined>(resumed);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const interruptedRef = useRef(false);
  // Read inside a handler that is subscribed once, so it cannot come from the
  // closure.
  const exitHintRef = useRef(false);
  // Authoritative: a run finishing reads this from a closure that was made
  // before the queue was added to.
  const queuedRef = useRef<string[]>([]);
  // How much of the transcript the terminal already holds: whole items, and
  // the rows of the answer still streaming that were flushed ahead of it.
  const writtenRef = useRef(0);
  const streamingRef = useRef<{ key: number; rows: number } | undefined>(
    undefined,
  );
  const committedRef = useRef(view.committed);
  committedRef.current = view.committed;

  const commands = useMemo(defaultCommands, []);
  const query = commandQuery(buffer.text);
  const matches =
    query === undefined || dismissed ? [] : matchCommands(commands, query);
  const menuOpen = matches.length > 0;
  const active = Math.min(selected, Math.max(0, matches.length - 1));
  const entries: MenuEntry[] = matches.map((match) => ({
    name: `/${match.command.name}`,
    description: match.command.description,
    match:
      match.end > match.start
        ? { start: match.start, end: match.end }
        : undefined,
  }));

  // Read by the key handler, which runs against whatever the last render left
  // rather than the closure it was made in.
  const menuRef = useRef<{ matches: CommandMatch[]; selected: number }>({
    matches: [],
    selected: 0,
  });
  menuRef.current = { matches, selected: active };
  // An approval owns the keyboard while it is up, menu or no menu.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;

  // A filter that changed is a different list, so the selection starts again
  // and a dismissed menu is allowed back.
  const queriedRef = useRef(query);
  useEffect(() => {
    if (queriedRef.current === query) return;
    queriedRef.current = query;
    setSelected(0);
    setDismissed(false);
  }, [query]);

  // Greedy word wrap settles every row but the last one, so an answer's earlier
  // rows can go into the scrollback while the rest of it is still arriving and
  // the terminal scrolls the whole window. A tool call's rows all keep changing
  // until it ends, so none of them are final.
  const liveAll = view.live ? itemLines(view.live, usable) : [];
  const stableRows =
    view.live?.kind === "assistant" ? Math.max(0, liveAll.length - 1) : 0;
  const tail = liveAll.slice(stableRows);

  // Before the frame is drawn: a row written after it has already been shown in
  // the footer appears twice, once in each place.
  useLayoutEffect(() => {
    for (const item of view.committed.slice(writtenRef.current)) {
      const streamed =
        streamingRef.current?.key === item.key ? streamingRef.current.rows : 0;
      commitLines(renderer, itemLines(item, usable).slice(streamed));
      if (streamed > 0) streamingRef.current = undefined;
    }
    writtenRef.current = view.committed.length;

    const live = view.live;
    if (live === undefined || stableRows === 0) return;
    const streaming = streamingRef.current;
    const from = streaming?.key === live.key ? streaming.rows : 0;
    if (stableRows > from) {
      commitLines(renderer, liveAll.slice(from, stableRows));
      streamingRef.current = { key: live.key, rows: stableRows };
    }
  });

  // Only a width change needs the transcript rewritten. Height changes fire
  // the same event, and setting the footer's height is one of them.
  const replayedAtRef = useRef(width);
  useOnResize((next) => {
    setScreenHeight(renderer.terminalHeight);
    if (next === replayedAtRef.current) return;
    replayedAtRef.current = next;
    replay(renderer, committedRef.current, next - 1);
    writtenRef.current = committedRef.current.length;
    // The rows of the streaming answer went with the cleared lines; they are
    // written again, rewrapped, on the next frame.
    streamingRef.current = undefined;
  });

  // The terminal's copy of the transcript is append-only, so a transcript that
  // is not a continuation has to be cleared and written again from nothing.
  const replaceTranscript = useCallback(
    (next: ViewModel) => {
      setView(withBanner(next, { model: model.id, workspace, version }));
      replay(renderer, [], usable);
      writtenRef.current = 0;
      streamingRef.current = undefined;
    },
    [renderer, usable, model, workspace, version],
  );

  const agent = useMemo(
    () =>
      new Agent({
        model,
        registry,
        workspace,
        ...(maxTurns !== undefined ? { maxTurns } : {}),
        requestApproval: autoApprove
          ? async () => "allow"
          : (request) =>
              new Promise<ApprovalDecision>((resolve) => {
                setPending({ request, resolve });
              }),
      }),
    [model, registry, workspace, maxTurns, autoApprove],
  );

  const startRun = useCallback(
    async (text: string) => {
      setView((current) => commitUser(current, text));
      setBuffer(emptyBuffer());
      const started = Date.now();
      setSince(started);
      interruptedRef.current = false;

      const existing = sessionRef.current;
      const session = existing ?? agent.start(text);
      if (existing) {
        existing.entries.push({ message: { role: "user", content: text } });
      }
      sessionRef.current = session;

      const controller = new AbortController();
      controllerRef.current = controller;

      // A throw here is the end of the run, not the end of the program. Left
      // uncaught the controller is never cleared, so every later prompt queues
      // behind a run that already stopped, and the renderer's own handler logs
      // the rejection into a console nothing is showing.
      try {
        for await (const event of agent.run(session, controller.signal)) {
          setView((current) => reduce(current, event));
        }
      } catch (error) {
        setView((current) =>
          reduce(current, {
            type: "error",
            error: error instanceof Error ? error : new Error(String(error)),
          }),
        );
      } finally {
        controllerRef.current = undefined;
      }

      const finished = Date.now();
      setView((current) =>
        commitElapsed(current, finished - started, finished),
      );

      const next = queuedRef.current.shift();
      if (next !== undefined) {
        setQueued([...queuedRef.current]);
        void startRun(next);
      }
    },
    [agent],
  );

  const ctx: CommandContext = {
    workspace,
    model: model.id,
    commands,
    setSession: (session) => {
      sessionRef.current = session;
    },
    replaceTranscript,
    setModel: (name) => setModel(createModel(name)),
    onExit,
  };
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const runCommand = useCallback(
    async (text: string) => {
      const { name, args } = parseCommand(text);
      const command = commands.find((candidate) => candidate.name === name);
      if (!command) {
        setView((current) =>
          commitInfo(current, `No command /${name}. Type / to see the list.`),
        );
        return;
      }
      if (command.needsIdle && controllerRef.current) {
        setView((current) =>
          commitInfo(
            current,
            `/${name} waits until the turn ends; Esc interrupts it.`,
          ),
        );
        return;
      }

      try {
        const output = await command.run(args, ctxRef.current);
        if (output !== undefined) {
          setView((current) => commitInfo(current, output));
        }
      } catch (error) {
        setView((current) =>
          commitInfo(
            current,
            error instanceof Error ? error.message : String(error),
          ),
        );
      }
    },
    [commands],
  );
  const runCommandRef = useRef(runCommand);
  runCommandRef.current = runCommand;

  // Typing is never blocked. A prompt sent while a turn is running waits its
  // turn instead of being refused, and is shown above the composer until then.
  const submit = useCallback(
    (text: string): boolean => {
      // A command is the interface's own work, so it never reaches the model
      // and never queues behind a turn.
      if (text.startsWith("/")) {
        void runCommandRef.current(text);
        setBuffer(emptyBuffer());
        return true;
      }
      if (controllerRef.current === undefined) {
        void startRun(text);
        return true;
      }
      // A full queue refuses, and the composer keeps the text rather than
      // dropping what was typed.
      if (queuedRef.current.length >= MAX_QUEUED) return false;
      queuedRef.current = [...queuedRef.current, text];
      setQueued(queuedRef.current);
      setBuffer(emptyBuffer());
      return true;
    },
    [startRun],
  );

  // A task given on the command line runs at once, as it does in line mode.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || initialTask === undefined) return;
    startedRef.current = true;
    void submit(initialTask);
  }, [initialTask, submit]);

  const showExitHint = (show: boolean): void => {
    exitHintRef.current = show;
    setExitHint(show);
  };

  useKeyboard((key) => {
    const controller = controllerRef.current;
    const menu = menuRef.current;

    if (menu.matches.length > 0 && pendingRef.current === undefined) {
      const count = menu.matches.length;
      const chosen = menu.matches[menu.selected]?.command;
      if (key.name === "escape") {
        setDismissed(true);
        return;
      }
      if (key.name === "up") {
        setSelected((menu.selected + count - 1) % count);
        return;
      }
      if (key.name === "down") {
        setSelected((menu.selected + 1) % count);
        return;
      }
      if (chosen && key.name === "tab") {
        // Completed, not run: an argument goes after the name.
        setBuffer({ text: `/${chosen.name} `, cursor: chosen.name.length + 2 });
        return;
      }
      if (chosen && (key.name === "return" || key.name === "enter")) {
        setBuffer(emptyBuffer());
        void runCommandRef.current(`/${chosen.name}`);
        return;
      }
    }

    if (key.name === "escape" && controller) {
      controller.abort();
      return;
    }

    if (key.ctrl && key.name === "c") {
      // While a turn is running the first press stops it rather than the
      // program; quitting then takes the same two presses as it does when idle.
      if (controller && !interruptedRef.current) {
        interruptedRef.current = true;
        controller.abort();
        return;
      }
      if (!exitHintRef.current) {
        showExitHint(true);
        return;
      }
      onExit();
    }

    // Any other key means they carried on, so the warning goes away.
    if (exitHintRef.current) showExitHint(false);
  });

  const session = sessionRef.current;
  const composing = pending === undefined;

  // Every part asks for the rows it wants; the plan decides what the screen can
  // actually hold, because a footer taller than the terminal takes the whole
  // screen and the composer is what falls off the bottom of it.
  const detail = pending?.request.detail;
  const plan = footerPlan({
    height: screenHeight,
    liveRows: tail.length,
    detailRows: pending ? (detail ? detail.split("\n").length : 0) : undefined,
    menuRows: menuOpen ? menuRows(entries, usable) : 0,
    queuedRows: queued.reduce(
      (total, text) => total + promptLines(text, usable).length,
      0,
    ),
    composerRows: composerRows(buffer, usable),
    spinner: view.running && !pending,
  });

  const liveLines = tail.slice(0, plan.live);
  const queuedLines = queued
    .flatMap((text) => promptLines(text, usable))
    .slice(0, plan.queued);

  // Before the frame reaches the terminal, not after: a footer sized a frame
  // late is a footer the spinner and the composer draw on top of each other in.
  useLayoutEffect(() => {
    renderer.footerHeight = plan.rows;
  }, [renderer, plan.rows]);

  return (
    <box flexDirection="column">
      {plan.live > 0 ? (
        <text content={styledText(opaqueLines(liveLines))} />
      ) : null}

      {pending ? (
        <Approval
          request={pending.request}
          width={usable}
          maxDetail={plan.detail}
          onDecide={(decision) => {
            pending.resolve(decision);
            setPending(undefined);
          }}
        />
      ) : null}

      {plan.spinner > 0 ? <Spinner since={since} width={usable} /> : null}

      {queuedLines.length > 0 ? (
        <text content={styledText(opaqueLines(queuedLines))} />
      ) : null}

      <Composer
        buffer={buffer}
        width={usable}
        maxRows={plan.composer}
        onChange={setBuffer}
        onSubmit={submit}
        isActive={composing}
        navigation={!menuOpen}
      />

      {plan.menu > 0 ? (
        <Menu
          entries={entries}
          selected={active}
          width={usable}
          maxRows={plan.menu}
        />
      ) : null}
      {exitHint ? (
        <text attributes={TextAttributes.DIM}>
          {opaque(padLine("  Press Ctrl-C again to exit", usable))}
        </text>
      ) : (
        <StatusLine
          model={model.id}
          workspace={workspace}
          session={session ? session.id : "new session"}
          turn={view.turn}
          context={view.context}
          width={usable}
        />
      )}
    </box>
  );
}
