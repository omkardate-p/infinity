---
name: pr-inline-comments
description: Push code-review findings to a GitHub PR as inline comments only, with no top-level review body, no "automated review from Claude Code" attribution and no signature. Use after /code-review when the user says "push inline comments", "post the findings inline", or "comment these on the PR". Differentiator: posts existing findings on an open PR; it does not commit, push, or open one, which is /ship-pr.
---

# pr-inline-comments

Reuse the findings already in this conversation; if there are none, ask the user to run `/code-review` first or to paste them. Ask for the PR number when it is ambiguous, and never guess it from the branch name. Run every command from the working directory so `gh` infers the repository; never name one.

## 1. Resolve the PR and its diff

```bash
gh pr view <num> --json title,url,state
gh pr diff <num> | grep "^diff --git"
```

## 2. Diff-verify every finding

A comment can only land on the RIGHT (new-file) side of a hunk: an added `+` line or an unchanged context line. Removed `-` lines and anything outside a hunk cannot be commented on.

Confirm the file is in the changed-file list, then read its hunk headers in `gh pr diff <num>`. Each `@@ -a,b +c,d @@` covers new-file lines `c` through `c+d-1`. Resolve the exact line by anchoring on a distinctive token from the finding, widening the anchor until it is unique. Drop anything that cannot be pinned to a single RIGHT-side line inside a hunk, with its reason recorded.

## 3. Post the review

Build the payload with `jq`, never by hand: bold, quotes and newlines in a finding break a raw heredoc. The top-level `body` must be an empty string, each comment body carries only the finding, and `event` is `COMMENT` unless the user asks otherwise.

```bash
: > <scratchpad>/comments.ndjson
jq -nc --arg path "<path>" --argjson line <newLine> --arg body "<finding body>" \
  '{path:$path, line:$line, side:"RIGHT", body:$body}' >> <scratchpad>/comments.ndjson

jq -sc '{event:"COMMENT", body:"", comments:.}' <scratchpad>/comments.ndjson > <scratchpad>/review.json

gh api "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/pulls/<num>/reviews" \
  --method POST --input <scratchpad>/review.json --jq '{state, html_url}'
```

A comment body is a bold one-line claim, then one to three sentences of failure scenario or fix. No attribution, signature or emoji.

The POST is the final gate. A 422 means that line was not in the diff after all: drop it, re-post the remainder, and never fall back to a top-level issue comment.

## 4. Report

State the review URL, how many comments landed, and every dropped finding with its reason. Never claim a finding was posted unless the returned review has it.
