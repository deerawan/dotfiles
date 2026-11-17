---
name: bd-pr-review
description: >-
  Review a teammate's pull request so the reader understands it before judging
  it: a plain-words orientation (why, what changes, behavior before and after,
  key changes, reading order), then a full bd-code-review, then inline comment
  drafts behind an approval gate. Run manually as /bd-pr-review <PR>.
argument-hint: "<PR number or URL> [yolo]"
disable-model-invocation: true
---

# bd-pr-review

Understand a teammate's PR first, then judge it, then comment on it. Orientation
comes before any finding, because a finding on code you haven't oriented in is
hard to weigh. bd-code-review only reads code; this skill owns everything that
touches the PR on GitHub.

```text
resolve PR → orientation → bd-code-review (findings, verdict) → comment drafts → gate → post
```

## Step 1: Resolve the PR

Run `gh pr view <pr> --json number,title,body,author,headRefOid,state,isDraft,url`.
Stop with the reason if the PR isn't open or is a draft. Compare the author with
`gh api user -q .login`. If you wrote it, say so, run Step 3 only, and stop:
orientation is for code you didn't write, and commenting on your own PR is noise.

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

Invoke bd-code-review with the PR. Show its report below the orientation.

## Step 4: Draft comments, then gate

Turn each verified finding into one inline comment, drafted per
`references/comment-style.md` (tone rules, then a bd-technical-writing pass). Each
draft carries an id `C1..Cn`, a severity prefix, and a full-SHA permalink: a blob
URL with the full `headRefOid`, `#L<start>-L<end>`, at least one context line each
side. Show every draft with its id, then **stop for explicit approval before any
`gh` write**.

At the gate a selection posts only the chosen ids: `post all`, `post C1 C3`,
`post all except C2`. Declining keeps the review terminal-only, so the gate is
also the opt-out. The `yolo` token is approval for the whole batch given up
front: post every draft immediately and show what was posted. Post via
`gh api repos/<owner>/<repo>/pulls/<n>/comments` with `path`, `line`, and
`commit_id`.

## Never

- Put a judgment in the orientation. Findings come only from bd-code-review's
  verified lanes.
- Read the full diff into this session. The orientation agent reads it.
- Post a comment before the gate (or its explicit `yolo` bypass), or comment on
  a PR you authored.
- Push, approve, request changes, merge, or file tickets.
- Guess the author's pronouns. Use their handle, or they/them.
