/**
 * The footer has to overwrite whatever the previous frame left in the cells it
 * covers. In @opentui/core 0.5.11 an incoming ASCII space does not do that, so
 * a spinner reading "Working (39s · esc to interrupt)" came out as
 * "Workingo(39se·tesc..." with the older text showing through its spaces.
 *
 * These render the real footer components over stale glyphs and assert nothing
 * survives.
 */

import { describe, expect, test } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { createElement } from "react";
import { Spinner, StatusLine } from "../tui/status.tsx";

const STALE = "X".repeat(60);

async function overStaleGlyphs(node: ReturnType<typeof createElement>) {
  const setup = await testRender(
    createElement(
      "box",
      { flexDirection: "column", height: 3 },
      createElement("text", { position: "absolute", top: 0, left: 0 }, STALE),
      createElement("box", { position: "absolute", top: 0, left: 0 }, node),
    ),
    { width: 60, height: 3 },
  );
  setup.renderer.start();
  await setup.flush();
  return setup.captureCharFrame().split("\n")[0] ?? "";
}

describe("the footer covers the cells it draws over", () => {
  test("the spinner leaves nothing of the previous frame", async () => {
    const row = await overStaleGlyphs(
      createElement(Spinner, { since: Date.now(), width: 60 }),
    );

    expect(row).toContain("Working");
    expect(row).not.toContain("X");
  });

  test("the status line leaves nothing of the previous frame", async () => {
    const row = await overStaleGlyphs(
      createElement(StatusLine, {
        model: "ornith:9b",
        workspace: "/tmp/w",
        session: "s1",
        turn: 2,
        width: 60,
      }),
    );

    expect(row).toContain("ornith:9b");
    expect(row).not.toContain("X");
  });
});
