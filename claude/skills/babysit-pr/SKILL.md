---
name: babysit-pr
description: Monitors the current branch's pull request until it is merge-ready — polls CI, diagnoses and fixes failures locally, and evaluates review comments — then re-arms itself via /loop so it keeps watching hands-off, pausing only when it needs to push, post a reply, or get a decision. Use when the user says "babysit this PR", "watch my PR", "monitor the PR", "keep an eye on CI", "get this PR ready to merge", or runs /babysit-pr.
---

# Babysit PR

Tend the **current branch's** pull request until it is ready to merge, then keep watching on your own. One invocation = one monitor-and-fix pass; the pass re-arms itself so the watch is continuous and hands-off — except at the two human gates below.

## The two human gates (why this loops but still respects your rules)

Work is split by blast radius:

- **Hands-off (the loop does it alone):** polling CI, pulling failure logs, fixing locally, committing, evaluating review comments.
- **Gated on you:** **pushing**, **posting anything to the PR** (thread replies, comments, resolving threads), and **judgment calls**. When a pass produces commits ready to push, drafts a reply to a reviewer, or hits a comment needing your decision, the pass **stops the loop and reports**. You approve; the next `/babysit-pr` pushes/posts and resumes watching.

So the loop sustains itself while CI runs or the branch is quiet, and deliberately breaks the moment it needs your approval or a human decision. Nothing leaves your machine without you saying so. This is your existing PR discipline, automated.

## One pass — the workflow

Run these steps in order. Do the safe local work; stop at the first gate you hit.

### 1. Identify the PR
```bash
gh pr view --json number,url,state,isDraft,mergeStateStatus,reviewDecision,headRefName
```
No PR for the current branch → report that and **stop** (nothing to babysit).

### 2. Gather signals (in parallel)
- **CI:** `gh pr checks` (add `--json` for machine-readable state).
- **Unresolved review threads:** GraphQL — fetch review threads with `isResolved`, comment bodies, file/line, and thread IDs.
  ```bash
  gh api graphql -f query='
  query($owner:String!,$repo:String!,$pr:Int!){
    repository(owner:$owner,name:$repo){
      pullRequest(number:$pr){
        reviewThreads(first:100){nodes{id isResolved isOutdated comments(first:20){nodes{id databaseId body path line author{login}}}}}
      }
    }
  }' -F owner=<owner> -F repo=<repo> -F pr=<number>
  ```
- **Review decision:** from step 1 (`reviewDecision`: APPROVED / CHANGES_REQUESTED / REVIEW_REQUIRED).
- **Behind base / conflicts:** `mergeStateStatus` (BEHIND, DIRTY = conflicts, BLOCKED, CLEAN).

### 3. Triage priority
Fix in this order — earlier items unblock later ones:
1. **CI failures**
2. **Merge conflicts / behind base**
3. **Review comments**

### 4. CI failures
```bash
gh run view <run-id> --log-failed
```
Classify each failure:
- **Flake** (timeout, runner died, transient network, known-flaky job) → re-enqueue: `gh run rerun <run-id> --failed`. Note it in the report; don't touch code.
- **Real** → reproduce locally, fix, then validate with the Monarch commands the failure implicates, run at repo root:
  - `npm run lint`, `npm run build` (or `npm run build:branch`), `npm run test`
  - `npm run graphql-codegen` at root if GraphQL/schema is involved (never per-package)
  - Commit locally with a clear message. **→ GATE: pause for push.**

### 5. Merge conflicts / behind base
Check draft status first (`isDraft` from step 1):
- **Non-draft PR:** `git merge origin/main` — **never** rebase + force-push (it destroys inline review comments).
- **Draft PR:** rebase onto `origin/main` is fine.

Resolve conflicts, re-run the relevant build/test, commit. **→ GATE: pause for push.**

### 6. Review comments
Delegate the *how* to the `receiving-code-review` skill (invoke it). For each unresolved thread:
- **Verify against the codebase first** — is the suggestion correct for *this* repo? Does it break something? Is there a reason for the current code?
- Decide **Fix / push-back / Escalate**, one item at a time, no performative agreement ("You're absolutely right!" is forbidden).
- **Draft** the reply for each thread and show it in the report — do **not** post it. **→ GATE: pause for reply approval.** Only after the user approves, post it in the thread (never as a top-level PR comment):
  ```bash
  gh api repos/<owner>/<repo>/pulls/<pr>/comments/<comment-id>/replies -f body='<reply>'
  ```
- **Every pushed fix gets a reply with its commit link.** Once a feedback commit is pushed, the approved reply for that thread must name the commit so the reviewer can jump straight to it — `https://github.com/<owner>/<repo>/commit/<sha>` (get `<sha>` from `git rev-parse HEAD` / `git log` after the push). Draft the reply with a `<commit link>` placeholder before the push and fill it in after; no pushed feedback commit is left unannounced in its thread.
- Resolving threads (`resolveReviewThread` GraphQL mutation) is likewise gated — propose which to resolve, resolve only once the user says so.
- **One commit per feedback item.** Fix one thread, commit it, move to the next — never bundle several reviewers' comments into one commit. Reference the thread in the message so the mapping is obvious (e.g. `Address review: <what changed>`). A pass that fixes four comments leaves four commits. **→ GATE: pause for push.**
- Anything subjective/architectural or that conflicts with a prior decision → **Escalate**: surface it and **pause**.

### 7. Verify & report
Report concisely:
- CI: pass / fail / running (which checks)
- Unresolved review threads: count + what's escalated
- Merge readiness: behind base? conflicts? approved?
- What this pass did (fixes committed, flakes re-run)
- Drafted replies awaiting approval (full text, per thread) — each one carrying the commit link, or a `<commit link>` placeholder if the fix isn't pushed yet
- **What needs you** (push approval? reply approval? a decision?)

### 8. Re-arm the loop (or stop)
- **Not merge-ready and not blocked on you** (e.g. CI still running, flakes re-enqueued) → keep watching:
  - `ScheduleWakeup` with `prompt: "/babysit-pr"` and a sensible `delaySeconds` (short if CI is actively running, longer if the branch is quiet).
  - Optional: arm a `Monitor` (`persistent: true`) on CI completion so the loop wakes the instant checks finish instead of waiting for the deadline. Arm once; on later passes `TaskList` first and skip if one is already running.
- **Blocked on your push, a pending reply, or a decision** → **stop the loop** and wait. You resume by approving/deciding, then the next `/babysit-pr` picks up.
- **Merge-ready** (CI green, threads resolved, not behind, approved) → report it's ready and **stop**. Do **not** auto-merge.

## Guardrails (non-negotiable)
- **Never auto-push.** Commit locally; push only after the user explicitly says so. One push per round.
- **Never post to the PR without approval.** Thread replies, comments, review submissions, and thread resolutions all wait for an explicit go-ahead. Approval covers only the drafts shown in that report — not the next round.
- **Never force-push a non-draft PR.** Use `git merge origin/main`, not rebase, to catch up base.
- **Never auto-merge.** Report merge-readiness only.
- **Never skip pre-commit hooks.** Create real commits for fixes.
- **One commit per review comment.** Never squash multiple pieces of feedback into a single commit — the reviewer must be able to read one commit per thread.
- **After pushing a feedback commit, reply in that thread with the commit link.** Every reviewer learns where their comment was addressed; the reply itself still needs approval.
- **Reply in review threads** (once approved), not top-level comments. Don't dismiss reviews.
- **Preserve the PR description** — never regenerate it.
- **Respect the repo's AGENTS.md / CLAUDE.md** and coding conventions.
- **No performative agreement** on review feedback (see `receiving-code-review`).

## Stop conditions
- Merge-ready → report + stop.
- Blocked on your push or decision → report + stop (you resume).
- Safety cap: after 3 consecutive passes with no forward progress and no new signals, do one final CI/threads check and stop.
