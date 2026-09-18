# Comments

A file opens with a short `/** */` block stating what it owns and what must not leak into it — `src/harness/tools/tool.ts` is the shape. That is the only block this repo allows.

Inside the body, default to none. Write one only for a cause outside this repo such as a provider quirk, a magic value the name does not state, an ordering requirement invisible in the statements, or a decision that looks wrong until you know why: `// Ollama sends a parsed object here; OpenAI sends a JSON string`. Remove the need first where you can — rename, extract a constant, split the branch.

Never restate the code. No commented-out code, no `TODO`.

Editing a file brings **every** comment in it to this rule, not only the ones near your change. Deliberate exception to §4 in `CLAUDE.md`; it covers comments and nothing else.

- Delete pure restatement, and any comment describing code that is gone.
- **Never expand an existing comment.** A rewrite comes out the same length or shorter. Adding a clause of rationale while "improving" one is how this rule usually breaks.
- Unsure whether the information survives elsewhere? Leave it and flag it.

Report reworked comments separately, so review can skip them.
