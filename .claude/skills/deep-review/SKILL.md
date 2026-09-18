---
name: deep-review
description: Review a target for correctness, convention compliance, and design: bugs via /code-review, this repo's written rules via /audit-changes, and the four change principles by investigating the repo. Takes the same arguments as /code-review, [low|medium|high|xhigh|max|ultra] [--fix] [--comment] [--post|--no-post] [<pr#>|<branch>|<path>]. Use when the user says "deep review", "review this properly", or invokes /deep-review, on a working-tree diff, a branch, a path, or a PR. Differentiator: /code-review finds bugs, /audit-changes checks the written rules, /verify runs the thing; this adds the design pass and merges all three into one verified list whose wording never cites a rule file.
---

# deep-review

Complete on its own; the caller adds nothing but arguments. Every run, unasked: judge the code against what this repository has written down rather than general good practice; run every pass over the one file set from §1; treat §2c as mandatory, because a change can be correct and still be the wrong change; hold your own work to the standard you hold a stranger's PR to; cite no rule file in any finding.

## 0. Parse arguments

- **Effort level**, a leading `low`/`medium`/`high`/`xhigh`/`max`/`ultra`. Absent is valid; `/code-review` reuses the last level typed. Pass through untouched, never substitute a default.
- **`--fix`**, **`--comment`**: **hold both back from the `/code-review` call**, because this skill acts on the merged set, not on one pass's subset. Honour them in §5.
- **`--post` / `--no-post`**, `ultra` only. Pass through verbatim.
- **Target**: PR number, branch, path, or nothing.

Two combinations cannot both be honoured, so check these before running anything.

- **`--post` with `--comment`**: the PR gets the same findings twice from two authors, one missing the convention pass. Stop and ask which. Never silently pick.
- **`--fix` with a PR target**: fixes land in the working tree, right only if that PR's branch is checked out. Compare `git branch --show-current` against `gh pr view <n> --json headRefName -q .headRefName`. If they differ, stop: offer to review without `--fix`, or have the user check it out. Never fix the wrong branch.

## 1. Resolve the target once

| Target | Changed files | Diff |
| --- | --- | --- |
| PR number | `gh pr view <n> --json files -q '.files[].path'` | `gh pr diff <n>` |
| Branch | `git diff --name-only origin/main...<branch>` | `git diff origin/main...<branch>` |
| Path | `git diff --name-only -- <path>` | `git diff -- <path>` |
| None | `git diff --name-only HEAD` **plus** `git ls-files --others --exclude-standard` | `git diff HEAD`, plus read each untracked file in full |

Every later step uses exactly this file set and diff. **Branch targets: `git fetch origin main` first, and base on `origin/main`.** A local ref goes stale the moment something merges, and a stale base silently widens the review to everything landed since. A file count far larger than the change should be means the base is wrong; re-fetch rather than review that list. Keep the PR number if the target is a PR; §5 needs it. All three passes below run over this file set, in order, and do not overlap; report nothing until §3.

## 2. The three passes

**a. Correctness.** Invoke `code-review` with the level, the target, and `--post`/`--no-post` if present. Nothing else. Hold its findings.

**b. Written rules.** Invoke `audit-changes` **in report-only mode**, naming the target explicitly so it audits this diff rather than the working tree. For a PR or branch, tell it which files and which diff. Report-only is required: invoked plainly it edits, and on a PR target it would edit the wrong tree.

**c. The four change principles**, which no rule file settles for you. Read before flagging and name what you found; the repo is small enough that this is reading, not searching.

- **Cause, not symptom.** Does the change fix what produces the behaviour, or compensate for it? Shapes: a detector correcting a bad state, a retry or timeout waiting out a race, a defensive branch or `?.` on a value that cannot arrive, an offset cancelling another layer's bug, a sentence of prompt standing in for a runtime defect. An agent defect wears the model's clothes, so say which of the two was proved.
- **No new complexity.** Count the call sites: an abstraction, wrapper, flag, option or generalisation with fewer than two present-day uses is a finding, because one caller is a function. So is a flag never passed `false`, and a wrapper that only forwards. Open the standing ban list the repo keeps and apply it rather than recalling it.
- **Reuse.** Open what already exists before flagging, and cite it by path. Flag the halfway states too: a second helper beside the one it replaces, and a migration that moved some call sites and left others.
- **Scope.** Does every changed line trace to the request, or to the three above in a file the change already opened? Drive-by renames and unrelated refactors are findings, and so is a whitespace-only hunk, which means `bun run lint:fix` was not run.

Only lines the diff touched, with one exception: **pre-existing complexity in a file the change opened is in scope.** Flag it as pre-existing, not the author's, and say what removing it costs. Pre-existing code in untouched files is never a finding. A behaviour claim in the diff or in the author's summary is not reviewable by reading: anything observable only against a live model is either proved through `verify` or reported as unproved.

## 3. Merge and verify

One list, then filter. **Deduplicate**: a line flagged by more than one pass is one finding, carrying the most concrete explanation. **Pin** each to a specific changed line, and drop what you cannot pin, what is conformant on a closer read, what is a preference established nowhere, and anything you cannot phrase per §4. A false finding costs more than a missed one.

## 4. Wording

Findings are read by people who have not read this repo's rule files and should not have to. Write the reason, not the citation: the runtime consequence, the failure case, the maintenance cost, or the inconsistency with named sibling code. When the reason is consistency, open the sibling and confirm it says what you claim, because a made-up precedent is worse than no reason. No nameable consequence and no sibling to point at: drop the finding.

Banned in any output: `CLAUDE.md`, `.claude/rules/`, rule file names, memory files, "project convention", "house style", "the rules", "as per our guidelines".

| Instead of | Write |
| --- | --- |
| "Violates the tool contract." | "This builds its own error string, so callers get a message shaped unlike every other one here and cannot match on it." |
| "Duplicates existing code." | "The shared helper at `<path>:<line>` already does this check, and covers the case this copy misses." |
| "This is a workaround." | "The retry hides the race rather than removing it, so the bug returns under slower timing." |

## 5. Flags

**Neither**: report only, edit nothing. **Both**: fix first, then comment only what you did not fix.

**`--comment`**: target must be a PR and `--post` must not be set. Invoke `pr-inline-comments` with the merged list; it diff-verifies and posts one inline-only review, every body per §4. Report the review URL, how many landed, and every dropped finding with its reason.

**`--fix`**: the §0 branch check must have passed. Apply to the working tree, then run `bun run lint:fix` followed by `bun run check`, and report both. That order matters: `check` runs the lint pass, which reports formatting, so running it first fails on whitespace the other command would have fixed. Never run eslint; it fails here in a way that reads like a broken install. Fix anything either command breaks in a file you touched before reporting done.

## 6. Report

One list, by file, most severe first: `file:line`, the one-line claim, the reason. Name which passes ran and on which target. Say plainly when the changes are clean.
