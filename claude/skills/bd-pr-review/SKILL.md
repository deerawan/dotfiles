---
name: bd-pr-review
description: >-
  Review a teammate's pull request so the reader understands it before judging
  it: a plain-words orientation (why, what changes, behavior before and after,
  key changes, reading order), then a full bd-code-review. Run manually as
  /bd-pr-review <PR>.
argument-hint: "<PR number or URL> [yolo]"
disable-model-invocation: true
---

# bd-pr-review

Understand a teammate's PR first, then judge it. Orientation comes before any
finding, because a finding on code you haven't oriented in is hard to weigh.

```text
resolve PR → orientation agent → "What this PR does" → bd-code-review (lanes, verdict, comment gate)
```

## Step 1: Resolve the PR

Run `gh pr view <pr> --json number,title,body,author,state,isDraft,url`. Stop with
the reason if the PR isn't open or is a draft. Compare the author with
`gh api user -q .login`. If you wrote it, say so and go straight to Step 3, since
orientation is for code you didn't write.

## Step 2: Orient

Dispatch one read-only `Explore` agent. Its prompt carries:

- the PR metadata from Step 1 and any ticket or plan linked in the PR body
- the diff command, `gh pr diff <pr>`, not the diff text
- the whole of `references/orientation.md`
- verbatim: "Read only. Do not post, comment, or edit anything. Never fabricate
  a file, line number, or behavior. Do not spawn subagents."

Show what it returns under `## What this PR does`. Fix only names it left
unexplained, following bd-explain.

## Step 3: Review

Invoke bd-code-review with the PR and pass through `yolo` if given. Its report,
comment drafts, and approval gate run unchanged below the orientation.

## Never

- Put a judgment in the orientation. Findings come only from bd-code-review's
  verified lanes.
- Read the full diff into this session. The orientation agent reads it.
- Post anything outside bd-code-review's comment gate.
- Guess the author's pronouns. Use their handle, or they/them.
