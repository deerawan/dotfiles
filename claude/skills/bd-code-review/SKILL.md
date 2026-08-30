---
name: bd-code-review
description: Multi-lane adversarial code review with a verification gate — reviews a PR, branch, or working tree against correctness, the originating spec/ticket, repo standards, and (for UI changes with a Figma link) design fidelity, reporting only verified findings by severity. Use when asked to review code, a PR, a branch, or a diff, or as a post-implementation checkpoint from another skill. Triggers on "review this PR", "review my changes", "bd-code-review". Not for reviewing plans or specs — that is plan-review. Not for replying to existing PR feedback — that is babysit-pr.
argument-hint: "[PR number/URL, ref, or blank for working tree] [low|medium|high] [yolo] [fix]"
---

# bd-code-review

Dispatch parallel reviewer lanes over one diff, verify every finding through a
confidence gate, and report survivors by severity with a verdict. Reviewers and
verifiers are fresh subagents — never this session's context. Unrecognized tokens:
note and ignore.

```text
scope → context pack → roster (effort dial) → parallel lanes → per-lane verifier
                                                                     ↓
                        report (default) | comment (gated) | fix | verdict block
```

## Step 1: Resolve scope — fail fast

| Invocation | Scope |
|---|---|
| PR number/URL | `gh pr view` (title, body, author) + `gh pr diff` |
| Bare ref/branch | `git diff <ref>...HEAD` (three-dot, merge-base) |
| No target | working tree + branch: `git diff $(git merge-base origin/<default> HEAD)` |
| Programmatic (another skill passed SHAs) | `git diff <base>...<head>`; caller may pass a spec/plan path and an effort |

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

## Step 3: Select the roster — effort dial

Default effort **medium**; programmatic callers default **low** unless they pass one.

| Effort | Lanes |
|---|---|
| low | correctness only |
| medium | + standards + whichever specialists trigger |
| high | + spec-fidelity + past-pr-comments + all triggered specialists, thresholds loosened |

Read `references/lanes.md` now — each lane's `Trigger:` and `Skip when:` lines decide
the roster mechanically. **Degradation rule:** a lane whose tool or source is missing
(no spec, no Figma or Figma MCP, `gh` unauthenticated) skips and is listed in Coverage
with its reason; it never fails the run.

## Step 4: Dispatch the lanes

Single message, one Agent call per rostered lane, read-only agent types (`Explore` for
repo-only lanes; `general-purpose` only where a lane needs MCP tools, e.g.
design-fidelity). Each prompt is self-contained:

- the diff command and commit list
- the context pack
- that lane's brief, pasted from `references/lanes.md`
- the `## Reportable-finding definition` section of `references/verify-rubric.md`,
  pasted verbatim
- return format: `severity? | file:line | summary | citation | why it matters`, one
  line per finding, under 400 words total
- verbatim: "Do NOT post, comment, merge, approve, label, or edit anything, and run no
  `gh` write commands or builds. Read only. Return your findings as text to me."
- "Never fabricate a finding, a citation, or a line number — report nothing over
  something unverified. Do not spawn subagents."

## Step 5: Verify — the gate

For each lane that returned findings, dispatch **one verifier subagent per lane**
(batch — never one agent per finding), read-only agent type, whose prompt is the whole
of `references/verify-rubric.md` plus that lane's findings and the diff command.

Apply the thresholds from the rubric (≥80 at low/medium; ≥60 at high, confidence shown
below 80). A lane with zero findings needs no verifier. Findings that die here are
gone — they never appear in any output mode.

## Step 6: Report

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
N. **[<Severity>, <confidence>]** <summary>
   `file:line` — <why it matters, one or two sentences>
   Fix: <if not obvious>

## Strengths                      ← short, specific, file:line — never filler

---
findings: N (critical X / important Y / nitpick Z) · lanes run x/9 · effort <level>
```

## Output modes

**Report (default)** — the skeleton above, in the terminal. Never touches GitHub.

**Comments — automatic on teammates' PRs.** When the target is a PR, check authorship
first: `gh pr view <pr> --json author -q .author.login` vs `gh api user -q .login`.
**Equal ⇒ report-only** with the note "comments skipped — you authored this PR" (yolo
included; commenting on your own PR is noise). **Different ⇒ always draft comments**:
each finding becomes one inline comment (severity prefix, full-SHA permalink: blob URL
with the full sha1, `#L<start>-L<end>`, ≥1 context line each side), all drafts shown
in the report, then **stop for explicit approval before any `gh` write** — declining
keeps the review terminal-only, so the gate is also the opt-out. The `yolo` token is
that approval given up front: post immediately and show what was posted. Post via
`gh api repos/<owner>/<repo>/pulls/<n>/comments` with `path`/`line`/`commit_id`.

**`fix`** — apply Critical and Important findings to the working tree; Nitpicks stay
report-only. Commit only if asked; **never push**.

**Programmatic** (invoked by another skill/agent) — end with this block so the caller
can gate on it:

```bd-code-review-verdict
verdict: <approve | approve-with-fixes | request-changes>
critical: <n>
important: <n>
nitpick: <n>
findings:
  - <severity> | <lane> | <file:line> | <one-line summary>
```

## Never

- Report a finding that did not pass the verifier, or re-rank findings across lanes.
- Post anything to a PR without the approval gate (or its explicit `yolo` bypass), or
  outside the teammate-PR comment flow.
- Comment on a PR the invoking user authored.
- Push, open PRs, merge, or file tickets — in any mode.
- Read the full diff into this session — lanes read it; you orchestrate and assemble.
- Block on a missing source or tool — degrade to Coverage instead.
