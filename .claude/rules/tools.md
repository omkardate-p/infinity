# Tools

A new tool is a new file exporting one `Tool`, added to `defaultTools()` read-only before mutating, which is the order the model sees them in. The tool names the model sees are snake_case while files are kebab-case, so search both. `readFileTool` and `writeFileTool` are suffixed to dodge Node built-ins.

`bound()`, `ok()`, `fail()` and `resolvePath()` exist so every tool behaves identically at its edges. A tool that formats its own error, caps its own output, or resolves its own path is a defect even when it works.

- `resolvePath()` is the only way a tool resolves a path — not `join`, not `resolve`, not a hand-rolled `startsWith`.
- A tool returns `ok()` or `fail()` and never throws past the registry. The registry validates input; the tool does not.
- Every schema carries `additionalProperties: false`.
- A `fail()` message is written for the model: what went wrong, and where there is one, what to do instead.

A tool that changes the workspace or runs a command awaits `ctx.requestApproval` itself before acting, then `fail(..., { reason: "denied" })` on refusal. The tool asks, not the loop, because only the tool has the diff or the command line to show. The loop counts denials on that exact string; change it and the runaway guard dies silently.
