/**
 * The root. It owns the transcript state, the composer buffer and the one
 * approval a tool can be waiting on, and it drives the agent.
 *
 * Every tool call the agent makes is awaited in sequence, so exactly one
 * approval is ever outstanding and no request needs correlating back to a call.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, useApp, useInput, useWindowSize } from "ink";
import { Agent } from "../src/agent/agent.ts";
import type { SessionState } from "../src/agent/state.ts";
import type { Model } from "../src/model/types.ts";
import type { ToolRegistry } from "../src/tools/registry.ts";
import type { ApprovalDecision, ApprovalRequest } from "../src/tools/tool.ts";
import { Approval } from "./approval.tsx";
import { Composer } from "./composer.tsx";
import { Transcript } from "./transcript.tsx";
import { Spinner, StatusLine } from "./status.tsx";
import { emptyBuffer, type Buffer } from "./editor.ts";
import { restore } from "./history.ts";
import { commitUser, empty, reduce, type ViewModel } from "./view-model.ts";

interface Pending {
  request: ApprovalRequest;
  resolve(decision: ApprovalDecision): void;
}

export function App({
  model,
  registry,
  workspace,
  maxTurns,
  resumed,
  initialTask,
  autoApprove,
}: {
  model: Model;
  registry: ToolRegistry;
  workspace: string;
  maxTurns: number | undefined;
  resumed: SessionState | undefined;
  initialTask: string | undefined;
  autoApprove: boolean;
}) {
  const { exit } = useApp();
  const { columns } = useWindowSize();

  const [view, setView] = useState<ViewModel>(() =>
    resumed ? { ...restore(resumed.entries), turn: resumed.turns } : empty(),
  );
  const [buffer, setBuffer] = useState<Buffer>(emptyBuffer);
  const [pending, setPending] = useState<Pending | undefined>(undefined);
  const [since, setSince] = useState(0);

  const sessionRef = useRef<SessionState | undefined>(resumed);
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const interruptedRef = useRef(false);

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

  const submit = useCallback(
    async (text: string) => {
      setView((current) => commitUser(current, text));
      setBuffer(emptyBuffer());
      setSince(Date.now());
      interruptedRef.current = false;

      const existing = sessionRef.current;
      const session = existing ?? agent.start(text);
      if (existing) {
        existing.entries.push({ message: { role: "user", content: text } });
      }
      sessionRef.current = session;

      const controller = new AbortController();
      controllerRef.current = controller;

      for await (const event of agent.run(session, controller.signal)) {
        setView((current) => reduce(current, event));
      }
      controllerRef.current = undefined;
    },
    [agent],
  );

  // A task given on the command line runs at once, as it does in line mode.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || initialTask === undefined) return;
    startedRef.current = true;
    void submit(initialTask);
  }, [initialTask, submit]);

  useInput((input, key) => {
    const controller = controllerRef.current;

    if (key.escape && controller) {
      controller.abort();
      return;
    }

    if (key.ctrl && input === "c") {
      if (controller && !interruptedRef.current) {
        interruptedRef.current = true;
        controller.abort();
        return;
      }
      exit();
    }
  });

  const session = sessionRef.current;
  const composing = !view.running && pending === undefined;

  return (
    <Box flexDirection="column">
      <Transcript committed={view.committed} live={view.live} width={columns} />

      {pending ? (
        <Approval
          request={pending.request}
          onDecide={(decision) => {
            pending.resolve(decision);
            setPending(undefined);
          }}
        />
      ) : null}

      {view.running && !pending ? <Spinner since={since} /> : null}

      <Box marginTop={1} flexDirection="column">
        <Composer
          buffer={buffer}
          onChange={setBuffer}
          onSubmit={submit}
          isActive={composing}
        />
        <StatusLine
          model={model.id}
          workspace={workspace}
          session={session ? session.id : "new session"}
          turn={view.turn}
        />
      </Box>
    </Box>
  );
}
