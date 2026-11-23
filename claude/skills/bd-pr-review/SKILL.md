---
name: bd-pr-review
description: >-
  Use ONLY when the user names this skill explicitly, as `/bd-pr-review <PR>` or
  "run bd-pr-review on <PR>". Reviews a teammate's pull request: a plain-words
  orientation, then bd-code-review, then inline comment drafts added to the
  user's pending review after approval. Never trigger on a general request to
  review a PR or code; that is bd-code-review.
argument-hint: "<PR number or URL> [yolo]"
---

# bd-pr-review

Understand a teammate's PR first, then judge it, then comment on it. Orientation
comes before any finding, because a finding on code you haven't oriented in is
hard to weigh. bd-code-review only reads code; this skill owns everything that
touches the PR on GitHub.

```text
resolve PR → orientation → bd-code-review (findings, verdict) → comment drafts → gate → pending review
```

## Step 1: Resolve the PR

Run `gh pr view <pr> --json number,title,body,author,headRefOid,state,isDraft,url`.
Stop with the reason if the PR isn't open or is a draft. Compare the author with
`gh api user -q .login`. If you wrote it, say so, run Step 3 only, and stop:
orientation is for code you didn't write, and commenting on your own PR is noise.

Put the review worktree at the PR head, so local links open files the PR adds
and their line numbers match the comments. Do this only when `git status
--porcelain` is empty and the branch belongs to this review (for example
`claude/pr-review-*`):

```bash
git fetch origin pull/<n>/head
git checkout --detach <headRefOid>
```

If the worktree is dirty or is the user's own branch, do not check out. Step 4
then shows permalinks only and says why.

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
`references/comment-style.md` (anatomy and tone rules, then a bd-technical-writing
pass). Give each draft an id `C1..Cn` and show it under this header:

```text
C5 · [add_…/handler.py:312](<repo-relative path>:312) · [permalink](<blob URL at headRefOid>#L<start>-L<end>)
```

The desktop app jumps to a line only when `:line` is inside the link target, so
the line goes in both the text and the target. The permalink uses the full
`headRefOid` and keeps at least one context line each side. Under the draft, add a
`Cited in the body:` line with each file the body cites as a `[file:line](path:line)`
link. The header and the cited line are terminal-only. The comment body keeps
plain code spans, because GitHub does not link paths. If Step 1 did not check out
the PR head, drop the local links, show the permalinks only, and say why.

Show every draft, then **stop for explicit approval before any `gh` write**.

At the gate a selection adds only the chosen drafts to the user's PENDING review:
`post all`, `post C1 C3`, `post all except C2`. Declining keeps the review
terminal-only, so the gate is also the opt-out. The `yolo` token is approval for
the whole batch given up front: add every draft at once. Nothing is published, so
the user can check the comments before teammates see them.

Before every post, look for the user's pending review, because GitHub allows only
one per user per PR:

```bash
gh api graphql -f query='{repository(owner:"<owner>",name:"<repo>"){pullRequest(number:<n>){id reviews(states:PENDING,first:5){nodes{id author{login}}}}}}'
```

- **No pending review by the user:** create one. Omit `event`, so the review stays
  pending.

  ```bash
  jq -n --arg sha <headRefOid> --arg path <path> --argjson line <line> --arg body "<body>" \
    '{commit_id:$sha, comments:[{path:$path, line:$line, side:"RIGHT", body:$body}]}' \
    | gh api repos/<owner>/<repo>/pulls/<n>/reviews --input -
  ```

  Put every selected draft in the `comments` array. Get the comment URLs with
  `gh api repos/<owner>/<repo>/pulls/<n>/reviews/<id>/comments`.
- **A pending review exists:** add each draft with `addPullRequestReviewThread`.

  ```bash
  gh api graphql -f query='mutation($r:ID!,$p:String!,$l:Int!,$b:String!){addPullRequestReviewThread(input:{pullRequestReviewId:$r,path:$p,line:$l,side:RIGHT,body:$b}){thread{comments(first:1){nodes{url}}}}}' -f r=<review id> -f p=<path> -F l=<line> -f b=<body>
  ```

After each post, show the comment URL and say that it is pending and visible only
to the user. The user submits the review on GitHub.

## Never

- Put a judgment in the orientation. Findings come only from bd-code-review's
  verified lanes.
- Read the full diff into this session. The orientation agent reads it.
- Post a comment before the gate (or its explicit `yolo` bypass), or comment on
  a PR you authored.
- Post outside the user's pending review, or submit that review.
- Push, approve, request changes, merge, or file tickets.
- Guess the author's pronouns. Use their handle, or they/them.
