---
name: bd-execute
description: Use when the user wants a bd-plan phase implemented — as a parallel crew or solo in the current session, operator's choice at the dispatch gate — or to report on a running crew. Given a raw request instead of a plan, it always runs bd-plan first; it never writes the plan itself. Triggers on "bd-execute", "execute the plan as a crew", "run phase N of the plan", "implement the plan in parallel worktrees/tabs", "crew status".
argument-hint: "[plan file path, topic, or raw request] [--phase N] [--cap N] [--step] [--yolo] [--checkpoint]"
model: claude-opus-4-8
---

# bd-execute — executor for bd-plan phases

Take an approved bd-plan plan, pick ONE phase, and implement it — either as a **parallel crew**
or **solo inline**. This file is the shared spine: resolve the plan, preflight, map the
branches, and gate. The operator picks the mode at the dispatch gate (Step 3); the full flow
for the chosen mode then lives in its own reference file.

```text
you ↔ lead (this session)          ← parallel crew
        │ herdr agent prompt / wait / read  +  status files
  ┌─────┼─────────┐
 tab1   tab2     tab3        ← herdr tabs in this workspace
 wt-a   wt-b     wt-c        ← stax worktree lanes
 claude claude   claude      ← one crewmate per task
  └── stax stack submit --draft → stacked draft PRs
```

**Two modes, chosen by the operator at the dispatch gate (Step 3):**

- **Parallel crew** (above) — for a phase with independent tasks worth running at once. Each
  task gets its own worktree, herdr tab, Claude session, and stacked draft PR. Full flow:
  [references/parallel-mode.md](references/parallel-mode.md). There you are the **lead** and
  never edit code — code is the crewmates' job.
- **Solo inline** — for a small phase (often one task, or a few tightly-coupled ones) where the
  crew overhead isn't worth it. This session implements every selected task itself, in
  dependency order, in the **current worktree** on **one branch**, and opens **one PR**. No
  herdr tabs, no stax lanes, no stack. Full flow:
  [references/solo-mode.md](references/solo-mode.md). There you are the implementer.

## Input

`$1` — plan file path, a topic to resolve inside `~/.claude/plans/` (same resolution as
bd-ticket: glob, ask on multiple hits, list 5 most recent if empty), or a raw request with no
plan behind it (see Step 0.1).

| Flag | Effect |
|---|---|
| `--phase N` | Execute phase N (number or name). Omitted → propose the first phase with unexecuted tasks and confirm at the dispatch gate |
| `--cap N` | (parallel) Max parallel crewmates per wave (default 4) |
| `--step` | (parallel) Human-stepped waves: pause after each wave settles and confirm before dispatching the next (recommended for a plan's first crew run) |
| `--yolo` | (parallel) Start crewmates with `--dangerously-skip-permissions` instead of the default `--permission-mode auto`. Only when the user explicitly passes it |
| `--checkpoint` | (parallel) Write `CHECKPOINT.md` for the in-flight run and stop. Spawns nothing, changes nothing else — use before clearing context (see [references/checkpoint-resume.md](references/checkpoint-resume.md)) |

**"crew status" (or "status" with no plan named) skips every step below:** run
`~/.claude/skills/bd-execute/scripts/crew-report.sh` and print its output verbatim. Exit 2
means several runs exist — ask which, then pass that run dir. Then handle any 🔁 row per
[references/parallel-mode.md](references/parallel-mode.md) *Retiring a merged lane*.

Unrecognized `--` tokens: note and ignore. `--checkpoint` skips the run entirely: resolve the
run dir, write the checkpoint, report the path.

Parallel mode keeps execution state in a run dir (`~/.claude/bd-execute/<plan-slug>/`) — its
layout and the `EXECUTION.md` / phase-file formats live in
[references/parallel-mode.md](references/parallel-mode.md). Solo mode keeps no run-dir state.

**Every PR you mention is a clickable link** — in chat, in tables, in the phase file, in the
plan write-back. Full URL (`https://github.com/<owner>/<repo>/pull/12258`), or the number as
a markdown link (`[#12258](url)`) where a column would blow out. A bare `#12258` is not
clickable in a terminal, so it never appears on its own.

## Step 0: Resolve Plan and Phase

**First, invoke the `bd-decision-log` skill.** Once the plan path is known, open this run
with an `execute:start` row in its log. Every call you make on the operator's behalf from
here on — recommendations, answers to crewmates, deviation handling — gets a row as it
happens.

1. Resolve and read the whole plan. Required: enumerated tasks with dependencies, `Files:`
   lists, and acceptance criteria. **No plan, or a plan missing that structure → invoke the
   `bd-plan` skill** with the request (or the unstructured plan) as input, whatever its size —
   bd-plan's depth gate keeps small work Lightweight, and its grounding is what the crew
   builds on. bd-plan reviews, autofixes, and saves with no approval prompt. Once it saves to
   `~/.claude/plans/`, restart Step 0 on that path; the dispatch gate (Step 3) is the
   operator's first and only approval, so show the plan path, bd-plan's review summary,
   and the decision log's one-line summary there. Never write the decomposition yourself — no invented `Files:` lists,
   dependencies, or acceptance criteria.
2. Identify phases. A flat (Lightweight) plan is one implicit phase. Select the `--phase`
   tasks; skip tasks already executed (a `**PR:**`/`**Branch:**` annotation from a previous
   run, or a settled status file in the run dir).
3. **Phase discipline:** tasks outside the selected phase do not exist this run. If a selected
   task depends on a task in a LATER phase, stop and report the plan inconsistency.
4. If a checkpoint precedes the selected phase in the plan and earlier-phase PRs are still
   unreviewed, say so in one line at the dispatch gate — the human decides whether to proceed.

## Step 1: Preflight

Run and report failures as one batch; each is fatal unless noted. Checks tagged **(crew)**
matter only if the operator picks the parallel crew at Step 3 — verify and run them there, not
now, since they mutate your session; solo mode needs none of them.

0. **Plan mode check, first.** bd-execute is an execution skill: it writes briefs, creates
   worktrees, spawns processes, and pushes (solo mode edits code, commits, and pushes here).
   Under plan mode the harness blocks all of that, and a run that discovers this halfway
   through leaves a half-built crew. Note whether plan mode is active — Step 3 uses
   `ExitPlanMode` as its gate if so. **Never call `EnterPlanMode` here**; planning belongs to
   `bd-plan`, and this skill has nothing read-only to offer.
1. `jq` and `gh auth status` (both modes). **(crew)** `stax --version` + `stax doctor` (run
   `stax init` if uninitialized, trunk = the repo default branch) and `herdr status` (server
   running) — deferred to the gate; run only once parallel is chosen.
2. **(crew) Identity — deferred to Step 3, run only once parallel is chosen; solo never claims
   a lead identity or renames your tab.** `herdr pane current` → record your own `pane_id`,
   `tab_id`, and `workspace_id` (crew tabs are created in this workspace). Then claim the lead
   identity:
   - `herdr agent rename <own-pane-id> <run-slug>-lead` — the **name** crewmates address.
     Agent names carry the run slug so the Agents sidebar stays legible across concurrent
     runs (`quickpay-lead`, `quickpay-task-0b`, `quickpay-task-5`); tab labels stay short.
     Names survive pane/tab rearrangement; pane ids don't, and tab ids are not valid agent
     targets. Keep every agent name ≤ 32 chars (herdr's limit) — shorten the run slug, never
     the `-lead` / `-task-<id>` suffix.
   - `herdr tab rename <own-tab-id> lead` — so the tab bar reads `lead | task-1 | task-2`.

   Record the previous tab label; parallel-mode.md restores it at its Step 8. Record the
   claimed agent name — the crewmates' briefs must carry whichever name you actually claimed.
3. `git fetch origin` in the main worktree. Warn (non-fatal) if trunk is behind origin —
   offer `stax sync` but don't run it unasked (it deletes merged branches).
4. **Discover the PR template path** — never assume it. Search the repo's supported
   locations (all case-insensitive):
   ```
   .github/pull_request_template.md | pull_request_template.md | docs/pull_request_template.md
   .github/PULL_REQUEST_TEMPLATE/*.md   (and the same dir under root or docs/)
   ```
   Record the winning path — it goes into every worker brief (parallel) or the single PR body
   (solo). Multiple templates in a `PULL_REQUEST_TEMPLATE/` dir → ask which one at the
   dispatch gate. None found → note it; free-form Problem / Solution / Testing bodies instead.
5. **(crew)** Previous run detection: if `<run-dir>` has settled status files, this is a
   **resume** — read [references/checkpoint-resume.md](references/checkpoint-resume.md) and
   follow its Resume procedure. (Solo mode keeps no run-dir state, so it never resumes — a
   re-run just skips tasks the plan already marks executed.)

## Step 2: Branch Map and Waves

For each selected task:

- **Branch name:** `<ticket-key-lowercase>-<short-slug>` when the task carries a
  `**Ticket:**` annotation (bd-ticket ran); else `<plan-slug>-t<N>-<short-slug>`. ≤ 40 chars.
  (Solo mode collapses the phase to one branch — see references/solo-mode.md.)
- **Parent (stack base):** the branch of the task's deepest dependency that has a branch in
  this or a previous run and is not yet merged; otherwise trunk. Dependencies whose PRs
  already merged collapse to trunk.
- **Waves:** topological layers over the selected tasks' dependencies (bd-plan phases are
  usually one wave, but derive anyway — flat plans and intra-phase chains exist). Two tasks
  sharing any path in `Files:` never share a wave; the later task waits, even without a
  declared dependency. Migrations and shared-state tasks stay sequential regardless. Solo mode
  runs this same topological order sequentially, without the wave grouping.

Sanity: DAG (no cycles); every parent is trunk or a branch created by this plan.

## Step 3: Dispatch Gate (non-bypassable)

**Spawn nothing, and edit nothing, before approval — even on resume.** The gate presents the
selected tasks AND asks the operator to choose the execution mode; the two are one decision.
Show, for the selected phase:

- the tasks (number, short title, `Files:`), plus permission mode and any checkpoint warning
  from Step 0.4;
- **Parallel crew** shape — the dispatch table (task, branch, parent, wave, tab label,
  worktree) and cap;
- **Solo inline** shape — the single branch name, its parent/base, and the dependency order the
  tasks run in, all in the current worktree, ending in one PR.

Recommend a default: **solo** when the phase is one task, or a few tightly-coupled tasks that
share files or form a clear sequential chain; **parallel** when the tasks are independent and
worth running at once. The operator's pick is both the mode and the go-ahead. Log the
recommendation as an `execute:mode` row whose `result` is the operator's pick.

How you gate depends on the harness state noted in Step 1.0:

- **Plan mode active** (the operator entered it themselves): present both shapes and your
  recommendation as the plan and call `ExitPlanMode`. That single call is "leave read-only and
  start" — approval accepts the recommended mode; if the operator wants the other mode they say
  so in their reply, and you honour it. Do not also ask via `AskUserQuestion`; two gates for
  one decision reads as a stall.
- **Plan mode not active:** ask via `AskUserQuestion` with options **Parallel crew** / **Solo
  inline** — the chosen option is the approval.

A rejection or a request for changes is not approval: revise the map (Step 2) and gate again.
Never spawn or edit to "show what it would look like".

**On approval, branch by mode:**

- **Solo** → follow [references/solo-mode.md](references/solo-mode.md). No run dir, no phase
  file, no crew preflight.
- **Parallel** → follow [references/parallel-mode.md](references/parallel-mode.md): run the
  deferred **(crew)** preflight (Step 1.1 stax/herdr, Step 1.2 lead identity claim + tab
  rename), write the phase file, then Steps 4-8.

## Never

Shaping rules (clickable PR links, the PR-body budget, the run-dir layout) live with the
sections that own them — these are the lines you never cross:

- Edit code, resolve conflicts, merge, rebase, or commit on any task branch **in parallel
  mode** — that is the crewmates' job. (Solo mode is the exception: there you are the
  implementer on the one branch, but you still never merge or rebase onto trunk.)
- Send a crewmate message content in a raw herdr prompt — every steer goes through
  `inbox-send.sh`; the prompt is only the doorbell.
- Remove a worktree, delete a branch, or close a tab without the human approving that exact
  task's retirement — merged is a prerequisite, not permission.
- Spawn before the dispatch gate, a task whose dependencies aren't `done`, or two
  path-overlapping tasks in one wave.
- Re-derive branch names or parents when `phases/phase-<N>.md` exists — the frozen map is the
  only source.
- Keep supervision state only in context — spawn times, decisions, and relayed questions go
  to `crew.json` / `CHECKPOINT.md` as they happen, not at clear-time from memory.
- Run spawn-crewmate.sh calls in parallel.
- Kill or close a stuck crewmate's tab; approve a permission prompt on the human's behalf.
- Execute tasks from a phase the user didn't select.
- `stax sync` / `stax sweep` unasked (they delete branches in bulk — retire merged lanes
  one task at a time instead).
- Let a crewmate push or open PRs before the parallel Step 7.4 handoff — after it, pushing
  fixes to its own branch is exactly its job.

## Verification

Before the dispatch gate:

- [ ] Plan resolved — or, with no structured plan, bd-plan run to a saved plan; phase
      selected; executed tasks skipped
- [ ] `bd-decision-log` loaded and an `execute:start` row written; its one-line summary
      shown at the gate
- [ ] Plan-mode state noted, so the gate uses `ExitPlanMode` (in plan mode) or
      `AskUserQuestion` (not) — one gate, never both, and `EnterPlanMode` never called
- [ ] Execution mode presented at the gate (solo inline vs parallel crew) with a recommended
      default; solo skips the crew preflight, the run-dir, and the crew steps (parallel-mode.md)
- [ ] Preflight green: gh auth, jq (both modes); PR template discovered. The crew checks —
      stax doctor, herdr server, workspace recorded, lead agent renamed to `<run-slug>-lead`
      and its tab to `lead` (previous label saved) — run only after the gate picks parallel
- [ ] Branch map: every parent is trunk or an in-plan branch; waves are a DAG; no
      path-overlap within a wave

Mode-specific done-checks live in each mode's reference file:
[parallel](references/parallel-mode.md) · [solo](references/solo-mode.md).
