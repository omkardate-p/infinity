---
name: audit-changes
description: Force-load this repo's CLAUDE.md and .claude/rules/, audit the named code against every one of them including the boundaries that break the codebase while the tests stay green, then run /simplify over the same code. Use when the user says "audit", "audit changes", or invokes /audit-changes. Differentiator: conformance to what this repo has written down plus a simplification pass, not a bug hunt (/code-review) and not the merged three-pass review (/deep-review). This skill edits: it repairs comments and applies /simplify's fixes.
---

# audit-changes

## 0. Load the rulebook first

Conformance to what this repo has written down, then simplification, in that order, because simplifying code that is about to be restructured wastes both passes. So load the rulebook before scoping, reading a diff, or forming any finding, fresh from disk every run, never an in-context copy, because these files change mid-session: `CLAUDE.md` at the repo root in full, then **every** file in `.claude/rules/`, not only those whose `paths` globs match the changed files. A rule that never loaded during the change is the one most likely broken, and catching that is why this audit exists.

**If either cannot be read, stop and say so.** Never audit from recollection of what the rules say, and never restate a rule in your own words before checking against it; the loaded text is the standard. Scope is what the user named; if nothing, the working-tree changes (`git status --porcelain`). Every pass below uses exactly that file list.

**Report-only mode.** When another skill invokes this one, or the user asks for findings without changes: run §1 and §4 only, skip §2's edits and §3 entirely, and report what you would have changed. Say the run was report-only. Invoked directly with no such instruction, this skill edits.

## 1. Conformance

Walk the loaded documents section by section, in their order, and pass or fail the code against each section as written. Never stop at the first few that produce findings. Each broken rule is one finding, pinned to a changed line. Two kinds need more than reading the diff. A boundary is checked by opening the file it governs, since a broken one passes typecheck and tests while defeating the codebase. A rule scoped by a `paths` glob applies to every audited file that glob covers, whether or not it loaded while the change was being written.

## 2. Comments

Apply the comment rule from `.claude/rules/` to every comment in an audited file, not only those near a change. Delete, rewrite, or keep exactly as that rule states, working from its text rather than memory of it. Unsure whether the information survives elsewhere: leave the comment and flag it.

## 3. Simplify

Invoke `simplify` over the same file list, after §1 and §2 so it works on code that already conforms. Where it contradicts a §1 finding, the written rule wins: revert that change and name it. Then `bun run lint:fix` followed by `bun run check`, in that order because `check` runs the lint pass and reports formatting. Fix anything it breaks in a file you touched.

## 4. Report

Keep a finding only if you can pin it to a specific line of the rulebook. Drop what you cannot pin, what is conformant on a closer read, and any preference written down nowhere. **A false finding costs more than a missed one.** Never name `CLAUDE.md` or `.claude/rules/` in the output: state the concrete reason the code is wrong instead. Then three groups, each marked empty when it is:

1. **Findings**, by file: `<path>`, then `- L<line>: the rule broken in your own words, and the fix`.
2. **Comments reworked**, kept separate as the comment rule requires, so review can skip them. Say when one was deleted rather than rewritten.
3. **Simplify**: what it applied, and anything reverted under §3.
