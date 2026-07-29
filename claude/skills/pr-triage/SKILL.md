---
name: pr-triage
description: Review-backed, risk-sorted triage of a repo's active pull requests. For each open, non-draft PR that is NOT yet approved, runs a cheap metadata/CI gate, then a read-only reviewer agent (report-only — never touches the PR) on the ones that could actually merge, and turns the review severity into a Merge-candidate / Hold / Request-changes verdict. Caches each PR's head SHA and verdict so an unchanged PR is never reviewed twice — safe to run as a routine (e.g. via /loop or /schedule). Use when the user asks to "triage PRs", "review the open PRs", "which PRs can I merge", "sweep the PR queue", set up a recurring PR review, or "pr-triage".
---

# PR Triage

Give a risk-sorted, **review-backed** read of a repo's **active** pull requests and recommend an action per PR. This is triage to focus a human's attention — it never merges, comments, closes, or labels. The merge decision stays with the user.

Three rules keep it correct and cheap:

- **Active = open, not draft, not approved.** Drafts haven't been sent for review and approved PRs are done being triaged — both excluded at selection (they never become candidates or hit the cache).
- **Layer cheapest-first.** A metadata/CI gate runs before any code review, so a PR that can't merge yet (red/pending CI, conflicts) is bucketed **Hold** without spending a review.
- **Never review the same SHA twice.** A per-repo cache stores each PR's head SHA + verdict. A completed review is reused as long as the SHA holds; only new or changed PRs cost review tokens.

## Step 1 — Select candidates (diffed against the cache)

```bash
scripts/select-candidates.sh [owner/repo] [limit]   # limit defaults to 20
```

Prints JSON: `{ repo, today, cacheFile, candidates:[...], pruned:[...] }`.

- **`candidates[]`** — each active PR with `number, title, author, isDraft, reviewDecision, headRefOid, updatedAt, changed`.
  - `changed:true` → new or head SHA moved. Needs the gate (Step 2) and possibly a review (Step 3).
  - `changed:false` → SHA unchanged since last run; the stored entry is attached as `cached`.
- **`pruned[]`** — cached PR numbers no longer active (approved/merged/closed). They drop off automatically (Step 5 rewrites the whole cache).

**Reuse rule (the idempotency guarantee), per `changed:false` candidate:**

- `cached.reviewed == true` → **reuse the cached verdict verbatim. Do NOT run a review or the gate.**
- `cached.reviewed == false` (it was a provisional Hold — red/pending CI or conflict, no review was ever spent) → **re-run the cheap gate only** (Step 2) with this run's fresh metadata, because CI pending→green or a conflict resolving can happen at the same SHA. Run a review (Step 3) only if it now clears the gate.

If every candidate resolves to a reused verdict, skip Steps 2–3 entirely and re-emit the table (Step 4), noting nothing changed.

## Step 2 — Cheap gate (metadata + CI, no review tokens)

For each candidate that needs work, decide if it can even merge yet. Bucket as **Hold** (do not review) when any hold:

- CI failing or still pending — `gh pr checks --repo <repo> <number>`
- Not mergeable / conflicts — `gh pr view --repo <repo> <number> --json mergeable,mergeStateStatus`

Everything that clears the gate (CI green, mergeable) proceeds to Step 3.

## Step 3 — Deep review (parallel read-only reviewer agents, report-only)

For each PR that clears the gate, spawn **one read-only reviewer agent**. They're independent — spawn them **in parallel, in a single message**. Use a read-only agent type (e.g. `Explore`); the review only needs to read the diff and reason about it.

Do **not** use the `code-review` plugin skill here — it posts a comment on the PR. This skill is advisory: the reviewer agent must be **strictly report-only** and return findings to the parent.

Each agent's prompt must contain the PR number, title, repo, and files touched, plus:

- Gather: `gh pr view --repo <repo> <n> --json title,body,files,additions,deletions` and `gh pr diff --repo <repo> <n>` (pipe huge diffs through `head -400`).
- Hunt, correctness-first and **high-confidence only** (the "low effort" bar — a flagged issue should be one you can trace, not a guess): logic errors, off-by-one/boundary, null/undefined propagation, broken error propagation, bad state transitions, race/ordering. For high-risk areas (auth, payments, DB migrations, shared infrastructure) also flag security and data-integrity issues.
- Severity: **RED** = blocking (breaks in normal use, or a security/data risk); **YELLOW** = minor/nit. Suppress low-confidence guesses and pre-existing issues on lines the PR didn't modify.
- No-fabrication clause: *"Only cite files and lines you actually opened. If you find nothing, say 'no blocking issues' — do not invent findings."*
- **Report-only clause (verbatim):** *"Do NOT post, comment, merge, approve, label, or edit anything, and run no `gh` write commands or builds. Read only. Return your findings as text to me."*
- Return format (the parent only sees the final message):

```
PR: <n>
RED: <count>
YELLOW: <count>
FINDINGS:
- [RED|YELLOW] <file:line> — <one-line concrete reason>   (or: none)
```

Map severity → verdict:

| Review result | Verdict |
|---|---|
| RED ≥ 1 | **Request changes** (not safe) |
| RED 0 (only YELLOW) | **Merge candidate** (low-risk) |

Risk rating (low/med/high) = RED/YELLOW counts × touched area (auth/payments/migrations/shared-infra lean high even at 0 RED — a clean review of a risky area is still "get a human's eyes").

## Step 4 — Report

Present directly in the conversation. Link every PR as `https://github.com/<repo>/pull/<number>`. Sort riskiest-first: **Request changes → Hold → Merge candidate**, higher risk first within a bucket.

```
# PR Triage — <repo> — <today>
<n> active · <r> reviewed this run · <u> reused (unchanged SHA) · <h> held pre-review

## 🔧 Request changes (<count>)
| PR | Title | Author | Risk | 🔴/🟡 | What to fix |

## ⏸️ Hold (<count>)
| PR | Title | Author | Why held |

## ✅ Merge candidate (<count>)
| PR | Title | Author | Risk | Review notes |
```

Reasons must be **review-backed** and concrete (`🔴 nil-deref at cartTotal.ts:42; missing test for empty-cart path`), not diff guesses. Mark reused rows with `↩︎ cached <lastTriaged>`.

Top bucket is **"Merge candidate," never "Safe to merge"** — the review is advisory; the human is the merge gate.

This skill stops at the report. Acting on a verdict (`gh pr merge`, posting a comment) is a separate, explicit, per-PR follow-up — never automatic.

## Step 5 — Persist the cache

Write every candidate from this run back so the next run skips unchanged SHAs. Each verdict needs its **current** `headRefOid` (from Step 1) and `reviewed` set correctly:

- `reviewed: true` for PRs a `/code-review` actually ran on (Merge candidate / Request changes) → reused verbatim next run while the SHA holds.
- `reviewed: false` for provisional Holds → cheap gate re-checked next run even at the same SHA.

```bash
echo '[{"number":123,"headRefOid":"<sha>","reviewed":true,"decision":"Merge candidate","reason":"clean; 0🔴 2🟡","risk":"low","red":0,"yellow":2,"effort":"low"},
       {"number":124,"headRefOid":"<sha>","reviewed":false,"decision":"Hold","reason":"pulumi-preview failing"}]' \
  | scripts/update-cache.sh <owner/repo>
```

The script replaces the cache with exactly the PRs passed in, so pruned entries disappear. Cache lives at `~/.claude/pr-triage/<owner>-<repo>.json` (user-level — shared across worktrees).

## Running as a routine

This skill is unattended-safe: it **never prompts** — it produces the report and persists the cache, nothing else. To run it on a schedule, pair it with `/loop` (in-session interval) or `/schedule` (cloud cron). Because reviews are SHA-scoped, a routine that fires repeatedly only pays for PRs that actually changed since last time; a quiet queue costs almost nothing.
