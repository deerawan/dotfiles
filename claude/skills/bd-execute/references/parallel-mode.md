# Parallel crew mode

The full crew execution flow, entered from the dispatch gate (SKILL.md Step 3) when the operator
picks **parallel**. You are the **lead**: you dispatch, supervise, communicate, and submit the
stack. **You never edit code, merge, or rebase.** Merging is the human's job; code is the
crewmates' job.

## Contents

- Run-dir state and formats
- Post-gate setup (crew preflight + phase file)
- Step 4: Write briefs, spawn the wave
- Step 5: Supervise
- Step 6: Advance waves
- Step 7: Submit the stack
- Step 8: Write back and report
- Retiring a merged lane
- Status report — on demand
- Checkpoint and resume
- If a lower PR changes after review
- Before reporting done (checklist)

## Run-dir state and formats

Run state lives in `<run-dir>` = `~/.claude/bd-execute/<plan-slug>/`. The plan file stays the
source of tasks; the run dir is execution state only, split so a run never loads more than it
needs:

```text
<run-dir>/
├── EXECUTION.md              ← index ONLY (≤ ~25 lines) — always read
├── phases/phase-<N>.md       ← that phase's frozen map + report — read only for that phase
├── crew.json                 ← roster (agent names, panes, tabs, worktrees, spawned_at)
├── CHECKPOINT.md             ← ephemeral handoff for a context clear; deleted on resume
├── task-<id>.brief.md        ← each crewmate's order
├── task-<id>.inbox/          ← lead→crewmate steers: NNN.msg + handled/ (mv = ack)
├── task-<id>.status          ← each crewmate's ground truth
├── task-<id>.pr.md           ← each crewmate's PR body; one-shot, dead once posted (Step 7.2)
└── task-<id>.testing.md      ← full tester report, verbatim; kept OUT of the PR body
```

`EXECUTION.md` carries run-wide facts and one line per phase — never a branch table:

```markdown
# bd-execute — <plan-slug>

Plan: <plan path>
Repo: <repo root> · Workspace: <id> · Lead: <lead agent name>
PR template: <path or none>

| Phase | Approved | Tasks | State | Detail |
|---|---|---|---|---|
| 1 | 2026-08-12 | 3 | complete | phases/phase-1.md |
| 2 | 2026-08-12 | 4 | in progress | phases/phase-2.md |
```

**Read `EXECUTION.md` always; read a `phases/phase-<N>.md` only when working that phase** —
except when computing a stack parent that lives in an earlier phase, where the branch column
of that phase's file is the lookup. Never load every phase file "for context".

## Post-gate setup (crew preflight + phase file)

On approval with **parallel** chosen, first run the deferred **(crew)** preflight from SKILL.md
Step 1 — Step 1.1 stax/herdr and Step 1.2 lead identity claim + tab rename — then, **before
spawning anything**, write `<run-dir>/phases/phase-<N>.md`:

```markdown
# Phase <N> — <name>

Approved: YYYY-MM-DD · Cap: <N> · Mode: <auto|yolo> · Step: <on|off>

| Task | Branch | Parent | Wave |
|---|---|---|---|
| 2 | abc-123-export-endpoint | abc-123-exports-table | 2 |

## Report
<!-- appended at Step 8: PR urls, blocked, stuck, minor findings -->
```

…and add/refresh this phase's one-line row in `EXECUTION.md` (creating that file with the
run-wide header on the first phase). Branch names and parents are **frozen** at this moment,
for every wave — including waves not yet spawned. Derivation (SKILL.md Step 2) happens once per
phase; after that, the phase file is the only source of the map.

## Step 4: Write Briefs, Spawn the Wave

For each task in the current wave (respect `--cap`; sub-batch if larger):

1. Write `<run-dir>/task-<id>.brief.md` from [worker-brief.md](worker-brief.md). Paste the plan
   task and Global Constraints **verbatim** — the crewmate has zero context.
2. Spawn **serially** (worktree creation races on `.git`):
   ```
   ~/.claude/skills/bd-execute/scripts/spawn-crewmate.sh <repo-root> <run-dir> <task-id> \
     <branch> <parent> <workspace-id> <lead-name> [--yolo]
   ```
   The script creates the stax lane, opens the herdr tab, starts Claude, records the roster,
   marks the task `running`, and delivers the brief. Verify each `SPAWNED` line; a failed
   spawn stops dispatch (don't spawn the rest of the wave on top of an inconsistent state).
3. Spawn time lands in `crew.json` as `spawned_at` automatically — read stuck-detection
   times from there, never from memory, so a context clear can't lose them.

## Step 5: Supervise

Two channels, and the status file always wins:

- **Push:** crewmates message you (`herdr agent prompt <lead-name> "bd-execute[...]: ..."`)
  when they finish, block, hit a `DEVIATION` that affects the plan or a sibling, or see their
  PR merge. Treat these as events, not truth — re-read the status file (or re-verify with
  `gh`/`git`) before acting.
- **Poll:** wait with a Monitor until-loop, every 60s:
  `~/.claude/skills/bd-execute/scripts/crew-status.sh <run-dir> <id...>` — exit 0 = wave
  settled. Each line is `id file-state herdr-state inbox:<unhandled>`.

**Steering inbox — every message you send a crewmate goes through it, never inline in a
herdr prompt.** Content in a prompt is gone if delivery fails; a file is not:

```
~/.claude/skills/bd-execute/scripts/inbox-send.sh <run-dir> <task-id> <agent-name> "<message>"
```

writes `<run-dir>/task-<id>.inbox/NNN.msg` durably, then rings a constant doorbell ("you
have mail"). The crewmate acts on each message and acks it by mv-ing it into `handled/`.
Because the doorbell carries no content, re-ringing is free — a duplicate is a no-op. When
a poll shows `inbox:` non-zero while the agent sits idle, re-ring
(`inbox-send.sh --ring <run-dir> <task-id> <agent-name>`) instead of re-sending; unhandled
mail on a `gone` agent is a contradiction — report STUCK.

Interventions (the only ones):

- `blocked` status → read the note; if you can answer from the plan/codebase, send ONE
  order through the inbox: `inbox-send.sh <run-dir> <id> <agent-name> "<answer>. Resume
  your brief."` (names from `crew.json`) — the crewmate rewrites its own status. If it
  needs the human, relay verbatim and wait.
- **`DEVIATION` report** → a crewmate found something that breaks someone else's
  assumptions, and it is still working. You are the only one who can see the blast radius,
  so triage it the moment it arrives:
  1. **Who else is affected?** Check the phase file for tasks whose brief consumes what
     changed, or whose `Files:` list includes the file that moved.
  2. **Running siblings** → relay it immediately and specifically, through each sibling's
     inbox: `inbox-send.sh <run-dir> <their-id> <their-name> "task <id> changed <what> to
     <new shape>. Re-check your work against it before reporting done."` A sibling coding
     against a signature that no longer exists is the failure this whole channel exists to
     prevent.
  3. **Unspawned tasks** → fix the brief before it is written; if the plan task itself is now
     wrong, note the divergence in the phase file so it doesn't get re-derived later.
  4. **Scope re-cut** (work landed in the wrong task, or a defect turned up outside anyone's
     scope) → do not silently reassign; put it to the human with your recommendation.
  5. **Record it** in the phase file's Report and in `CHECKPOINT.md` (a deviation you only
     hold in context is lost on the next clear).

  Never sit on a relay to "batch" it — the cost of a deviation is proportional to how long a
  sibling keeps building on the stale assumption.
- herdr-state `blocked` (permission prompt — auto mode still asks for actions outside its
  allowlist) → tell the user which tab needs a click; never approve on their behalf.
- Running > 30 min past spawn, or file-state/herdr-state contradictions (e.g. `running` but
  agent `gone`) → report STUCK in chat with `herdr agent read <agent-name>` tail. **Never
  kill a crewmate** — the human decides.
- `done` without commits on the branch (`git log <parent>..<branch>` empty) → treat as STUCK.
- **PR merged → retire the lane** (procedure: *Retiring a merged lane*, below). Two ways
  you learn this, and either one starts that procedure:
  - **The crewmate tells you** — it babysits its own PR, so it sees the merge first and
    messages `task <id> MERGED on <branch> — worktree clean|DIRTY`. This is the normal path
    and costs no polling.
  - **You notice on a poll** — `gh pr view <branch> --json state,mergedAt` for tasks with
    PRs, whenever you're already polling a wave. Covers crewmates that died or were closed.

  Merges usually land after Step 8, when you are idle and polling nothing — so the crewmate
  report is what keeps retirement working past the end of the run. Stay reachable: keep the
  lead name claimed while any PR from this run is open (released in Step 8.4).

## Step 6: Advance Waves

When the wave settles: `blocked` tasks halt their transitive dependents (mark them blocked
with "upstream <id> blocked" and exclude from later waves); independent branches continue.
Compute the next wave (dependencies all `done`) and return to Step 4 — children fork from the
just-committed parent branch, which already exists locally.

Under `--step`, pause here: report the settled wave (per-task outcome, diffstat per branch)
and confirm via `AskUserQuestion` before dispatching the next wave. An unambiguous yes
proceeds; anything hedged is a no — revise per the feedback and ask again.

## Step 7: Submit the Stack

When no runnable tasks remain in the phase:

1. From each leaf branch of the phase's stack (in the main worktree):
   `stax checkout <leaf> && stax stack submit --draft --no-prompt --yes --no-template`.
   This pushes every branch and opens/updates linked draft PRs bottom-up. `--no-template` is
   deliberate and load-bearing: step 2 posts a body only into an empty one, so a stub
   pre-filled here would read as a body and make step 2 skip the task — stranding the empty
   template on the PR instead of the crewmate's `<run-dir>/task-<id>.pr.md`.
2. Apply the crewmates' bodies **for every task** (this is what puts the template shape on
   the PR, not stax). **`pr.md` is a one-shot handoff: post it only into an empty body.**
   Once a PR has a body, the PR is the source of truth and `pr.md` is a stale copy — a
   human may have added screenshots or edited it since. Check the length, never the body,
   so the text stays out of your context:
   ```bash
   gh pr view <branch> --json body -q '.body | length'   # 0 covers null and empty
   ```
   - `0` → `gh pr edit <branch> --body-file <run-dir>/task-<id>.pr.md`. Disk to GitHub;
     nothing passes through you. A task with no `pr.md` gets its body written by you from
     its status file and plan task — never leave a PR with an empty body.
   - non-zero → **leave it alone.** Already posted on an earlier pass or edited by hand.
     Re-applying `pr.md` is what silently destroys a human's screenshots. If it genuinely
     needs changing, invoke `bd-pr`, which fetches the live body and splices.

   **Check each body before posting it** — you are the last gate, and a crewmate that just
   spent hours in one task tends to over-explain it:
   ```bash
   awk '/PULUMI_PREVIEW_START/{exit} {print}' <run-dir>/task-<id>.pr.md | wc -w
   git diff --shortstat <parent>...<branch>
   ```
   Over ~450 words, longer than its own diff, or containing logs / test transcripts /
   commit narration → trim it yourself (invoke `bd-pr`) before `gh pr edit`. Keep the
   template headings and comment markers intact while trimming, and leave the full tester
   report where it belongs: `task-<id>.testing.md`.
3. Verify: `stax ll` shows a PR per branch, each PR's base is its parent branch (trunk for
   roots), all drafts, and every PR body carries the repo template's headings — including
   any HTML comment markers CI depends on. Fix any that don't with `bd-pr`, working from the
   body fetched off the PR — never by re-applying `pr.md`, which would revert hand edits.
4. **Hand each PR back to its author to babysit.** Only now — the crewmate's tab is still
   open on its own branch, so it is the cheapest place to fix CI. For each task with a PR,
   send the babysit order through its inbox:
   ```
   inbox-send.sh <run-dir> <task-id> <agent-name> "Your PR is open: <pr-url>. Run /babysit-pr (or, if that
   skill isn't in your session, poll gh pr checks and fix failures) and keep watching it.
   You may now commit AND PUSH fixes to <branch> — lifted for your own branch only. Still
   never merge, never rebase onto trunk, never touch another branch or re-target the PR
   base; don't guess on review feedback that changes intent — ask <lead-name>. Report to
   <lead-name> when it is green. When gh pr view shows MERGED: verify git status
   --porcelain is empty, message <lead-name> 'bd-execute[<run-slug>]: task <id> MERGED on
   <branch> — worktree clean, ready to retire' (or '— worktree DIRTY: <what>'), then stop —
   never delete your own worktree, branch, or tab; the lead retires the lane."
   ```
   Skip a task whose agent is `gone` (report it instead — the human can re-open the lane) or
   whose PR failed to open.

## Step 8: Write Back and Report

1. Annotate each executed task in the plan (bd-ticket's write-back style — surgical,
   idempotent, no body rewording): `**Branch:** <branch>` and `**PR:** <url>` (or
   `**PR:** none — blocked: <note>`) under the task heading, and append one Revision History
   line for the run.
2. Fill the phase file's `## Report` section (PR url per task, blocked, stuck, minor
   findings) and set this phase's `State` in the `EXECUTION.md` index row to `complete` (or
   `partial — N blocked`). The index stays one line per phase.
3. Report:
   ```
   Phase <N> — <name>
   Stack (merge bottom-up):
     1. task <id>  [#<num>](<pr-url>)   base <parent>  head <branch>
     ...
   Blocked: <id> — <note>
   Stuck:   <id> — <state> since <time>
   Minor findings: <collected from status files>
   Babysitting: <task-id list> — each crewmate is watching its own PR and will report
   back; it pauses for you on review decisions, and reports the merge when it lands.
   Tabs left open: <task-id list> — each lane stays until you approve retiring it, which
   I'll offer as soon as its PR merges.
   Retired this run: <task-id list — approved and removed> (or `none`)
   Next: <checkpoint text from the plan, or "phase N+1 ready: /bd-execute <plan> --phase N+1">
   ```
4. Leave crew tabs and lanes in place — they're the review surface until each PR merges, at
   which point *Retiring a merged lane* reclaims them one task at a time. Bulk cleanup is
   offered, never done.

   **Keep the lead identity while any PR from this run is open** — that name is the address
   crewmates use to report their merges, and clearing it early strands them. Release it only
   once every task is merged or handed back to the human:
   `herdr agent rename <run-slug>-lead --clear` and
   `herdr tab rename <own-tab-id> <previous label>`.

## Retiring a merged lane

A crewmate's merge message is an event, not proof. Per merged task:

1. **Verify** — `gh pr view <branch> --json state` is `MERGED`, and
   `git -C <worktree> status --porcelain` is empty.
2. **Ask before removing anything.** Deleting a worktree and branch is irreversible, so it
   is the human's call, every time — never automatic. Batch all merged tasks into one
   `AskUserQuestion` (Retire / Keep, per task or all-at-once), showing exactly what goes:
   ```
   Task 1 — search index view · PR merged
     worktree ~/.stax/worktrees/<repo>/feat-1234-search-index (clean)
     branch   feat-1234-search-index
     tab      task-1
   ```
   A **dirty worktree is not offered for retirement** — report what's uncommitted and let
   the human deal with it. `Keep` leaves everything in place; ask again next status.
3. **On approval**, per approved task, in this order:
   - `inbox-send.sh <run-dir> <task-id> <agent-name> "PR merged — stand down; I'm closing
     this tab."` — a durable record; don't wait for the ack, closing the tab is the
     enforcement — then `herdr tab close <tab-id>` (ids from `crew.json`).
   - `stax worktree remove <branch> --delete-branch` — removes the lane and the local
     branch. Without `--delete-branch` the branch lingers and later runs may mistake it
     for live work.
   - Re-point any **unspawned** child whose frozen parent was this branch to the parent it
     collapses to (trunk, or the nearest unmerged ancestor); note the change in the phase
     file. Children already spawned keep their base — their PRs re-target on GitHub when
     the base merges; do not rewrite their branches.
   - Record it: set the task's row in the phase file to `retired` and drop its entry from
     `crew.json`.
4. Tasks the human declined stay `merged` in the phase file, lane intact.

Only **merged** PRs are ever offered — a closed-unmerged PR keeps its lane until the human
says otherwise. Never run `stax sync`'s bulk branch deletion to achieve this; retire lanes
one task at a time, so a surprise never takes a branch you still need. If you find yourself
in a fresh session with lanes still around, run this procedure over `crew.json` once.

## Status report — on demand

Whenever the user says "status" (or asks how the run is going), answer with this table and
nothing else unless they asked for more. Read it fresh from `gh` + the phase file + status
files — never from memory.

```markdown
**Status — <run-slug>, phase <N>** (merge bottom-up)

| Task | PR | State | Review |
|---|---|---|---|
| 1 — search index view | [#12260](https://github.com/<owner>/<repo>/pull/12260) | Draft | Review required |
| 0b — Lambda switch | [#12258](https://github.com/<owner>/<repo>/pull/12258) | Merged | ✅ Approved |
| 5 — GraphQL contract | [#12259](https://github.com/<owner>/<repo>/pull/12259) | Active | Changes requested |
| 3 — domain model | — | Not submitted | — |
```

- **Order:** bottom-up by stack position, so the top row is what merges next — not task-number
  order.
- **Task:** `<task no> — <short description>` from the plan's task title.
- **PR:** always a clickable `[#num](url)`; `—` when nothing is open yet.
- **State:** `Draft` / `Active` / `Merged` / `Not submitted` — from
  `gh pr view <branch> --json isDraft,state`.
- **Review:** `✅ Approved` / `Changes requested` / `Review required` — from `reviewDecision`.
- Add a line under the table only when there is something to say: blocked tasks with their
  note, stuck tasks with their state and age.

**Every `Merged` row triggers the retirement question** — run *Retiring a merged lane*
(above) over the merged rows.

## Checkpoint and resume

Clearing the lead's context loses supervision, not progress — crewmates are separate live
sessions and keep working. The checkpoint format, its rules, and the full resume procedure
live in [checkpoint-resume.md](checkpoint-resume.md). **Read that file the moment any of these
happen:**

| Trigger | Who fires it |
|---|---|
| The user says "checkpoint", "I'm clearing context", "/clear soon", "compact", "pause this" | user, mid-run — write it, confirm in one line, then wait |
| `/bd-execute <plan> --checkpoint` | user, from a session that lost the thread — re-read the run dir, write it, stop |
| Right after answering a blocked crewmate, relaying a deviation, or putting a question to the human | you, automatically |
| Before any wait longer than a poll cycle (a wave in flight, `--step` pause, babysitting) | you, automatically |
| Resuming: `<run-dir>` has settled status files or a `CHECKPOINT.md` | you, at SKILL.md Step 1.5 |

## If a lower PR changes after review

Not this skill's loop, but the one-liner the user needs: fix on the lower branch, then
`stax worktree restack` (restacks every lane) and `stax stack submit` to update the PRs.

## Before reporting done

- [ ] `phases/phase-<N>.md` written (frozen branch map for ALL waves) and the `EXECUTION.md`
      index row added/refreshed — both before the first spawn
- [ ] Briefs written with the plan task pasted verbatim
- [ ] Every selected task settled (`done`/`blocked`) with a consistent branch state
- [ ] Stack submitted: PR per done-task, drafts, bases = parents; bodies applied from
      `task-<id>.pr.md`, each word-counted and shorter than its diff; each live crewmate
      handed its PR to babysit
- [ ] Plan annotated (Branch/PR per task + Revision History); phase file's Report filled and
      the index row's State updated; report includes blocked, stuck, and minor findings —
      not just successes
