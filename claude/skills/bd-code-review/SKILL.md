---
name: bd-code-review
description: Multi-lane adversarial code review with a verification gate — reviews a PR, branch, or working tree against correctness, the originating spec/ticket, repo standards, and (for UI changes with a Figma link) design fidelity, reporting only verified findings by severity. Use when asked to review code, a PR, a branch, or a diff, or as a post-implementation checkpoint from another skill. Triggers on "review this PR", "review my changes", "bd-code-review". Not for reviewing plans or specs — that is plan-review. Not for replying to existing PR feedback — that is babysit-pr.
argument-hint: "[PR number/URL, ref, or blank for working tree] [incremental] [yolo] [fix]"
---

# bd-code-review

Dispatch parallel reviewer lanes over one diff, verify every finding through a
confidence gate, and report survivors by severity with a verdict. Reviewers and
verifiers are fresh subagents — never this session's context. Unrecognized tokens:
note and ignore.

```text
scope → context pack → roster → parallel lanes → per-lane verifier → merge dupes
                                                                          ↓
                        report (default) | comment (gated) | fix | verdict block
```

## Step 1: Resolve scope — fail fast

| Invocation | Scope |
|---|---|
| PR number/URL | `gh pr view` (title, body, author) + `gh pr diff` |
| Bare ref/branch | `git diff <ref>...HEAD` (three-dot, merge-base) |
| No target | working tree + branch: `git diff $(git merge-base origin/<default> HEAD)` |
| Programmatic (another skill passed SHAs) | `git diff <base>...<head>`; caller may pass a spec/plan path and `incremental` |

Before any agent spawns: the ref must resolve (`git rev-parse`), the diff must be
non-empty, and a PR target must be open and not draft. Fail here with the bad ref or
empty-diff message — never inside a lane. Capture the diff command once; every prompt
carries the command, not the diff text.

## Step 2: Build the context pack

One cheap pass, handed to every reviewer:

- **Intent summary** — what the change is trying to do, 2–4 sentences, from the PR
  body/commits/branch name.
- **Touched paths + diff stats.**
- **Guidance chain** — paths of root and touched-directory CLAUDE.md/AGENTS.md files.
- **Spec discovery**, in order: Jira key in branch name or commit messages → plan file
  (`~/.claude/plans/`, key-prefixed filenames like `vp-4487-…`, then `docs/`) → PR
  body. Fetch tickets via the Atlassian MCP (`getJiraIssue`) — never `twg`, never `gh`.
- **Figma discovery** — a Figma URL in the ticket, PR body, or plan file.

A source that isn't found is recorded for the Coverage section, not an error.

## Step 3: Select the roster

Every lane runs whenever its own source exists. Read `references/lanes.md` now — each
lane's `Trigger:` and `Skip when:` lines decide the roster mechanically. **Degradation
rule:** a lane whose tool or source is missing
(no spec, no Figma or Figma MCP, `gh` unauthenticated) skips and is listed in Coverage
with its reason; it never fails the run.

## Step 4: Dispatch the lanes

Single message, one Agent call per rostered lane, read-only agent types (`Explore` for
repo-only lanes; `general-purpose` only where a lane needs MCP tools, e.g.
design-fidelity). Each prompt is self-contained:

- the diff command and commit list
- the context pack
- that lane's brief, pasted from `references/lanes.md`
- the `## Reportable-finding definition` and `## Finding action` sections of
  `references/verify-rubric.md`, pasted verbatim
- return format: `severity? | action | file:line | summary | citation | why it matters`,
  one line per finding, under 400 words total
- verbatim: "Do NOT post, comment, merge, approve, label, or edit anything, and run no
  `gh` write commands or builds. Read only. Return your findings as text to me."
- "Never fabricate a finding, a citation, or a line number — report nothing over
  something unverified. Do not spawn subagents."

## Step 5: Verify — the gate

For each lane that returned findings, dispatch **one verifier subagent per lane**
(batch — never one agent per finding), read-only agent type, whose prompt is the whole
of `references/verify-rubric.md` plus that lane's findings and the diff command.

Apply the threshold from the rubric (score ≥ 60; findings below 80 show their
confidence). A lane with zero findings needs no verifier. Findings that die here are
gone — they never appear in any output mode.

## Step 6: Merge duplicates

Verifier survivors from different lanes can name the **same defect** — a swallowed error
caught by both `correctness` and `silent-failure`, a magic value flagged by both
`standards` and `type-design`. Collapse any two survivors that share a `file:line` (or an
overlapping range) **and** the same root cause into one finding: keep the higher severity
and the clearer framing, display it in the owning lane's section, and tag the other
contributing lane(s) on it. This is **not** the cross-lane re-ranking the Never list
forbids — two survivors on the same line describing *different* problems stay separate.

## Step 7: Report

Assign each survivor a severity — **Critical** (must fix: verified defect, security
hole, data loss, spec violation) / **Important** (should fix before merge, or
explicitly decline with reasoning: real risk or debt, no defect yet) / **Nitpick**
(nice to have). Verdict by the approval standard — "does this definitely improve code
health", not "is it perfect": any Critical ⇒ **Request changes**; any Important ⇒
**Approve with fixes**; only Nitpick ⇒ **Approve**.

Findings stay **grouped by lane and are never re-ranked across lanes** — a spec failure
must not hide behind a standards pass. Report skeleton:

```markdown
# Code Review: <scope> (<files>, +<add>/−<del>)

**Verdict: <Approve | Approve with fixes | Request changes>** — <one-line rationale>

## Coverage
| Lane | Ran? | Why |            ← every lane, ran or skipped-with-reason

## <Lane name>                    ← one section per lane that ran, findings numbered
N. **[<Severity>, <action>, <confidence>]** <summary>   ← append "(also: <lane>)" if merged
   `file:line` — <why it matters, one or two sentences>
   Fix: <if not obvious; for ask-user, name what authorizing the remedy would add>

## Strengths                      ← short, specific, file:line — never filler

---
findings: N (critical X / important Y / nitpick Z) · lanes run x/11
```

## Output modes

**Report (default)** — the skeleton above, in the terminal. Never touches GitHub.

**Comments — automatic on teammates' PRs.** When the target is a PR, check authorship
first: `gh pr view <pr> --json author -q .author.login` vs `gh api user -q .login`.
**Equal ⇒ report-only** with the note "comments skipped — you authored this PR" (yolo
included; commenting on your own PR is noise). **Different ⇒ always draft comments**:
each finding becomes one inline comment — body drafted per `references/comment-style.md`
(tone rules, then a humanizer pass in the author's voice) — carrying an id `C1..Cn`, a
severity prefix, and a full-SHA permalink (blob URL with the full sha1,
`#L<start>-L<end>`, ≥1 context line each side). Show every draft with its id in the
report, then **stop for explicit approval before any `gh` write**. At the gate a
selection posts only the chosen ids — `post all`, `post C1 C3`, `post all except C2` —
and declining keeps the review terminal-only, so the gate is also the opt-out. The
`yolo` token is approval for the whole batch given up front: post every draft
immediately and show what was posted. Post via
`gh api repos/<owner>/<repo>/pulls/<n>/comments` with `path`/`line`/`commit_id`.

**`fix`** — apply Critical and Important findings marked **`auto-fix`** to the working
tree; Nitpicks stay report-only. **Never auto-apply an `ask-user` finding**, whatever its
severity — surface each with what authorizing its remedy would add, and let the author
decide. After applying, run the project's test command (discover it from the repo; if none
is found, note that and skip the guard) — revert any applied hunk that turns the suite red
and report that finding as still-open. Commit only if asked; **never push**.

**Programmatic** (invoked by another skill/agent) — end with this block so the caller
can gate on it:

```bd-code-review-verdict
verdict: <approve | approve-with-fixes | request-changes>
critical: <n>
important: <n>
nitpick: <n>
findings:
  - <severity> | <action> | <lane> | <file:line> | <one-line summary>
```

## Incremental review — `incremental`

Re-reviewing the same target after new commits: review only what moved, carry the rest.

Cache: `~/.claude/bd-code-review/<owner>-<repo>.json` (user-level, shared across
worktrees), one entry per target keyed by PR number or branch name, holding `base_sha`,
`head_sha`, `verdict`, and the reported `findings` (severity, action, lane, file:line,
summary). **Every run — incremental or not — rewrites its target's entry at the end**, so
the next incremental run has a baseline.

With the `incremental` token, after Step 1 resolves the current head and merge-base:
- **No entry, or the merge-base moved (rebase)** → full review; Coverage notes
  "incremental: full — no prior review" / "base moved".
- **Entry present, same base** → lanes read only the delta,
  `git diff <cached head_sha>...<current head>`. Prior findings on files the delta does
  **not** touch carry forward verbatim (code unchanged ⇒ still open). Prior findings on
  files the delta **does** touch are dropped — the fresh pass re-derives them, so a fix
  clears one and an unaddressed one returns.

Report over the union of carried-forward and fresh findings, then Steps 6–7 as normal; the
verdict is recomputed across the whole union, never just the delta. Mark carried-forward
findings `↩︎ unchanged since <date>`. Without the token, every run is a full review.

## Never

- Report a finding that did not pass the verifier, or re-rank findings across lanes.
- Auto-apply an `ask-user` finding in `fix` mode.
- Post anything to a PR without the approval gate (or its explicit `yolo` bypass), or
  outside the teammate-PR comment flow.
- Comment on a PR the invoking user authored.
- Push, open PRs, merge, or file tickets — in any mode.
- Read the full diff into this session — lanes read it; you orchestrate and assemble.
- Block on a missing source or tool — degrade to Coverage instead.
