---
name: bd-ticket
description: Turn a plan file's tasks into dependency-linked Jira or Linear tickets — classified Story vs Task, deduped against existing work, each carrying acceptance criteria — drafted for confirmation before anything is created, then written back into the plan as task-to-key mappings.
argument-hint: "[plan file path or topic] [--project KEY] [--epic KEY] [--dry-run] [--no-writeback]"
disable-model-invocation: true
---

# bd-ticket

Take an implementation plan (normally produced by `bd-plan`) and turn its tasks
into real tickets in the connected task system. Every ticket carries acceptance
criteria and correct dependency links; nothing is created until the user
approves a draft.

**Creation is the last step and it is gated.** Everything before Step 7 is
read-only against the task system: fetch, search, classify. No `create*`, no
`edit*`, no transitions.

**The plan file is the only file bd-ticket writes**, and only in Step 9, only
after tickets exist. No source edits, ever.

**Scope: top-level tickets only.** bd-ticket creates the Stories and Tasks it
finds in the plan. It does not decompose them into sub-tasks and does not
impose any team's splitting convention — if a sub-task breakdown skill is
installed, offer it as the follow-on (Step 10).

**Discover, never assume.** Issue type names, link type names, custom field
ids, and workflow status names differ per instance. Every one of them is read
from the API at runtime. This skill hardcodes none of them, and carries no
team's estimation scale, sprint cadence, or project keys.

## When to Use

- A plan file exists and the work needs to become tickets a team can pick up
- Tickets need creating from a spec where the tasks are already enumerated
- Re-running against a plan that has since been revised (see Re-runs, Step 4)

## Input

`$1` — plan file path, or a topic to resolve inside `~/.claude/plans/`.

| Flag | Effect |
|---|---|
| `--project KEY` | Skips the project question in Step 2 |
| `--epic KEY` | Skips epic detection in Step 2 |
| `--dry-run` | Stop after the Step 7 draft; never create, even if the user approves |
| `--no-writeback` | Create tickets but leave the plan file untouched (Step 9) |

Unrecognized `--` tokens: note and ignore.

---

## Step 0: Resolve the Plan

1. If `$1` is a path, read it. If it's a topic, glob `~/.claude/plans/` for the
   closest match; on more than one plausible hit, ask which — never guess
   between two plans.
2. If `$1` is empty, list the 5 most recently modified plans and ask.
3. Read the whole plan. The sections bd-ticket consumes:
   - **Tasks** — one candidate ticket each
   - **Acceptance Surface** (truths T1…Tn) — drives Story-vs-Task classification
   - **Sources** — spec, design, and upstream ticket links to carry into bodies
   - **Global Constraints** — surfaced on tickets whose task depends on them

   A plan in another format is fine — map its equivalents and say how you
   mapped them. What's required is enumerated tasks plus something that states
   what "done" means.
4. If the plan has neither per-task acceptance criteria nor an acceptance
   surface, **stop**. bd-ticket derives criteria from the plan; it does not
   invent product behavior. Say what's missing and point at `bd-plan`.

If `--dry-run` was passed, say so in one line now so the user knows the
confirmation gate cannot create anything this run.

## Step 1: Detect the Task System

Resolve in this order, stopping at the first hit, and **announce the result in
one line** with which signal decided it:

1. **Explicit in the plan** — a ticket key pattern (`ABC-123`) or a
   `linear.app/` / `atlassian.net/browse/` URL in Sources or a task body.
2. **Connected MCP** — Atlassian tools present → Jira. Linear tools present →
   Linear.
3. **Both connected, no plan signal** — ask via `AskUserQuestion`. Do not
   default.
4. **Neither connected** — stop. Report which MCP is missing and that the draft
   can still be produced with `--dry-run`.

The rest of this skill names Jira concepts. On Linear, the mapping is:

| Concept | Jira | Linear |
|---|---|---|
| Container | Epic | Project or parent issue |
| Story / Task | issue type | **label**, not type — Linear has no Story/Task types |
| Dependency | `Blocks` issue link | `blocks` / `blocked by` relation |
| Duplicate search | JQL | issue search filtered by team |

Where the Linear mapping is unclear at runtime, ask rather than approximating.

## Step 2: Resolve Target Project and Epic

1. **Project — always ask explicitly** via `AskUserQuestion` unless
   `--project` was passed. Offer the projects the API returns
   (`getVisibleJiraProjects`, or the Linear team list); if the plan hints at one,
   list it first and label it as a guess. Never infer silently: a batch of
   tickets in the wrong project is tedious to undo.
2. **Epic — detect, else ask.** Search the plan and `$1` for an epic key. If
   found, fetch it and confirm it's the right parent by showing its summary. If
   not found, ask: create a new Epic (offer a summary derived from the plan's
   Overview), attach to an existing one the user names, or leave tickets
   parentless. **Never create an Epic unasked.**
3. **Discover the instance's metadata** before drafting:
   - project issue types and their ids — "Story" and "Task" are conventions,
     not guarantees; a project may have neither
   - issue link types, with their exact inward and outward names, for Step 6
   - the project's To Do / Backlog-equivalent status names, for the in-flight
     rule in Step 4
4. Assignee defaults to the current user; it appears in the draft for override.

**Do not set estimates and do not assign a sprint or cycle.** Grooming is a
human step and every team scales it differently. Leave those fields untouched,
on create and on update. If the user explicitly asks for estimates in the
invocation, ask which scale their team uses — never assume one.

## Step 3: Classify Each Task — Story or Task

Loop the plan's tasks. The plan's own two truth registers decide it:

| Ticket type | Signal | Test |
|---|---|---|
| **Story** | Traces to a **user-observable** truth | A human using the application can see the difference |
| **Task** | Traces only to a **system-observable** truth | Verifiable by running the system — tests green, a migration applied, a log line or metric visible — with no user-visible change |
| **Bug** | The plan's task restores behavior that is supposed to work already | Only when the plan frames it as a fix, not a feature |

Applied to common shapes: schema migration, API contract or stub, build/CI
config, refactor, dependency bump → **Task**. A vertical slice a user can
exercise end-to-end → **Story**.

If the project has no Story type (or no Task type), map to the closest type it
does have and say so in the draft — don't create types.

Two rules that matter more than the table:

- **A task tracing to no truth is not a ticket.** The plan's own self-check
  calls that scope creep. Exclude it from the draft and list it under
  Excluded with the reason — don't launder it into a Task.
- **Don't merge or re-split the plan's tasks.** bd-ticket is a translation
  layer; the decomposition was already reviewed. The one exception: a plan task
  whose title contains "and" and which covers both a user-visible outcome and a
  technical enabler — flag it in the draft with a proposed split and let the
  user decide. Never split silently.

## Step 4: Dedupe Against Existing Work

Run **before** drafting, so the draft shows what already exists. For each
candidate ticket:

1. Search the target project. Two passes, because either alone misses:
   - **Keyword** — match on the distinctive nouns of the task (the entity, the
     endpoint, the component), not its verb.
   - **Structural** — everything already under the epic, plus anything
     referencing the same Sources link (spec page, design file, upstream ticket
     key).
2. **Include done and closed issues.** The most expensive duplicate is
   re-creating work someone already shipped.
3. Classify every candidate against what the search returned:

| Verdict | Definition | Draft action |
|---|---|---|
| **New** | No meaningful match | Create |
| **Duplicate** | An existing ticket covers the same concern | **Always ask** — see Duplicate resolution below. Never create alongside it. |
| **Overlap** | An existing ticket covers part of it, or the candidate covers part of a broader existing one | **Always ask.** Offer: narrow the candidate to the uncovered remainder, update the existing ticket, or skip. |
| **Stale** | Existing epic child maps to no candidate — the plan dropped it | **Never auto-close.** Flag for human review. |

4. **Existing tickets that are in flight are read-only.** If a Duplicate or
   Overlap match sits outside the project's To Do / Backlog-equivalent statuses,
   do not propose editing or deleting it; note it and move on. Someone is
   working in there.

### Duplicate resolution

Never resolve a duplicate silently — not even to skip it. Ask per duplicate
(batch up to 4 questions per `AskUserQuestion` round), showing the existing
ticket's key, status, summary, and age, with three options:

| Option | Effect | When it fits |
|---|---|---|
| **Keep** *(default)* | Skip the candidate; the existing ticket stands unchanged | Its content is still accurate |
| **Rewrite** | Overwrite the existing ticket's summary, description, and AC with the plan's version | The plan has moved on and the ticket is stale — **preferred whenever the key can stay** |
| **Delete and recreate** | Permanently remove the existing ticket, then create the candidate fresh | The existing ticket is genuinely junk — wrong project, malformed, created by mistake |

**Rewrite is the recommended default of the two write options.** It keeps the
key, so existing links, branches, PR references, and anything anyone has
bookmarked still resolve. Before applying it, show what changes — old summary
vs new, and which AC lines are added, dropped, or reworded — so the user is
approving a diff, not a promise.

**Delete is permanent and needs its own guardrails.** A deleted issue takes its
comments, history, worklogs, attachments, and inbound links with it, and the
key is never reused. So:

- **Withhold the delete option entirely** — offer only Keep and Rewrite, and
  say in one line why — when the ticket is outside To Do / Backlog, has
  comments, worklogs or attachments, has inbound issue links, has sub-tasks
  (deleting a parent cascades to them), or references a branch or PR.
- **Require a second, explicit confirmation** naming the exact keys at the
  moment of execution in Step 8. Approving the Step 7 draft is not enough
  authorization to delete — a draft approval covers creating, not destroying.
- **Offer closing as the middle path.** When the user wants the ticket gone but
  it fails a guardrail above, offer a transition to a Done / Won't Do
  equivalent with a comment pointing at the replacement. Auditable, reversible,
  keeps the key.
- **If delete fails** — permission denied, or the API rejects it — stop and
  report. Do not silently fall back to closing or to Rewrite; the user picked a
  specific outcome and deserves to know it didn't happen.

**Re-runs:** a second run against a revised plan is the normal case, not the
exception. The dedupe pass is what makes it safe — it is never skippable, not
even when the user says "just create them".

## Step 5: Acceptance Criteria

Every ticket ships with acceptance criteria. No exceptions — a ticket without
them is not draftable.

1. **Take them from the plan.** A task's **Acceptance criteria** block is the
   ticket's AC, near-verbatim. Do not paraphrase into vaguer language.
2. **Add the plan's verification step** as the last criterion when it names a
   command or observable outcome.
3. **Test scenarios stay.** Carry happy path / edge / error / integration lines
   into the body — they're what makes the ticket implementable by someone with
   no conversation context.
4. **Never invent an AC to fill a gap.** If a task has none and none can be
   derived from the truths it traces to, put the ticket in the draft marked
   `AC MISSING — needs input` and ask in the confirmation round. Inventing
   product behavior at ticket-creation time is how untraceable scope enters a
   sprint.

Format the body in the target system's flavour, AC as a checklist. Link to
Sources by URL — never to a local plan path, which reviewers can't open.

## Step 6: Map Dependencies to Links

The plan's `Dependencies:` and `Consumes / Produces` blocks are the source.

1. Build the graph: task → the tasks it depends on.
2. **Direction, stated once so it can't invert:** if Task B depends on Task A,
   then **A blocks B** and **B is blocked by A**. Create the link from A
   outward with the `Blocks` type, or from B with `is blocked by`. Getting this
   backwards is the most common failure and it silently misleads the board.
3. Use the link type names discovered in Step 2 — not remembered strings. If
   the instance has no blocks-equivalent link type, fall back to its relates
   type and state the dependency in the body.
4. **Relates**, not Blocks, when two tickets share a contract or a file but
   neither gates the other.
5. Cross-plan and cross-project dependencies: link them the same way when the
   other ticket key is known; when it isn't, write the dependency as a prose
   note in the body rather than dropping it.
6. Links are created **after** all tickets exist (Step 8) — a link needs both
   keys.

Sanity-check the graph before drafting: no cycles, and every task the plan
marked parallel has no link between the parallel members.

## Step 7: Draft and Confirm — Mandatory Gate

Present the full draft in chat, then stop and ask. **No bypass.** Bulk-created
tickets are painful to clean up, and the draft is where wrong project, wrong
epic, and inverted links get caught.

```markdown
## Ticket draft — <plan name>

**System:** Jira (<signal that decided it>)
**Project:** ABC    **Epic:** ABC-12 <title>  |  none
**Assignee:** <name>    **Estimates/sprint:** not set (grooming is manual)

### To create (N)
| # | Type | Summary | Traces to | Depends on | AC |
|---|---|---|---|---|---|
| 1 | Task  | Add exports table migration | T2 | — | 3 |
| 2 | Story | User can trigger a CSV export | T1, T3 | #1 | 4 |

### Duplicates — your call (N)
- #4 "Add exports table" → ABC-40 (Done, 3mo old) — keep / rewrite
  (delete withheld: has 6 comments and a linked PR)
- #6 "Export button" → ABC-52 (To Do, 2d old) — keep / rewrite / delete

### Needs your decision (N)
- Overlap: #3 vs ABC-45 (To Do) — narrow / update existing / skip?
- #5 AC MISSING — needs input

### Excluded (N)
- Plan Task 7 — traces to no truth (scope creep per the plan's own self-check)

### Stale — for your review (N)
- ABC-47 under this epic maps to no plan task

### Links to create (N)
- #1 **blocks** #2
```

Then show each ticket's **full body** — description, AC checklist, test
scenarios, Sources links — for at least the Stories and any ticket the user
flags. Ask for confirmation via `AskUserQuestion`, including the open decisions
above as questions. Resolve every "Needs your decision" item before creating
anything.

Under `--dry-run`, stop here regardless of the answer.

## Step 8: Create

Only after explicit approval, and only what the approved draft says:

1. **Deletions first, and only these**, in this order: re-confirm the exact keys
   the user chose to delete (Step 4's second confirmation — a fresh
   `AskUserQuestion` listing each key and summary), delete them, verify each is
   gone, then proceed. If the user declines at this gate, fall back to Keep for
   those duplicates — not to Rewrite. If a delete fails, stop the whole run and
   report before creating anything: half-deleted duplicates plus new tickets is
   the worst state to leave the board in.
2. **Create the Epic** if the user chose to create one.
3. **Create tickets** — parallel create calls: project, issue type from Step 2's
   discovered metadata, parent/epic link, summary (≤80 chars), description
   (body + AC + Sources), assignee. Leave estimate and sprint/cycle unset.
4. **Then create links** — parallel link calls using the Step 6 graph and the
   discovered link type names.
5. **Apply approved edits** to existing tickets — Duplicate Rewrites and
   Overlap updates — only tickets still in To Do / Backlog, only the fields the
   user saw in the diff.
6. **Apply approved closes** — the middle-path transitions from Step 4, each
   with a comment naming the replacement key.
7. If a create fails, report it and **do not retry blind** — a partial success
   plus a retry is how duplicates appear. Report what exists, what didn't, and
   let the user decide.

## Step 9: Write the Results Back to the Plan

The plan is the executor's prompt; a plan that doesn't know its own ticket keys
sends the next session hunting the board. Write back immediately after Step 8,
before reporting.

1. **Annotate each task in place.** Insert or refresh one line directly under
   the task heading:

   ```markdown
   ## Task 2: User can trigger a CSV export
   **Ticket:** ABC-124
   ```

   Every task in the plan gets a line, including the ones that produced no new
   ticket — the absence is information too:

   | Outcome | Line |
   |---|---|
   | Created | `**Ticket:** ABC-124` |
   | Existing ticket covers it, kept | `**Ticket:** ABC-40 (existing — duplicate, kept)` |
   | Existing ticket rewritten | `**Ticket:** ABC-40 (existing — rewritten from this plan)` |
   | Duplicate deleted, recreated | `**Ticket:** ABC-126 (replaced deleted ABC-40)` |
   | Narrowed against an overlap | `**Ticket:** ABC-125 (narrowed — overlaps ABC-45)` |
   | Excluded | `**Ticket:** none — excluded (traces to no truth)` |
   | Create failed | `**Ticket:** none — creation failed, see Revision History` |

2. **Add or refresh a `## Tickets` section** after Sources — the whole run at a
   glance, so nobody reads the task list to reconstruct it:

   ```markdown
   ## Tickets

   System: Jira · Project: ABC · Epic: [ABC-12](url)

   | Task | Type | Ticket | Blocks | Created |
   |---|---|---|---|---|
   | 1 | Task | [ABC-123](url) | ABC-124 | 2026-08-11 |
   | 2 | Story | [ABC-124](url) | — | 2026-08-11 |
   ```

   Absolute URLs, not bare keys — the plan gets read outside the terminal. Get
   the date from the system, never from memory.

3. **Append to Revision History** — one line per run: date, what was created,
   updated, skipped, and failed. This is what makes a third run legible.

4. **Idempotent.** A re-run **updates** the existing `**Ticket:**` line and the
   existing `## Tickets` row in place. Never append a second line to a task,
   never leave two rows for one task. A key that has since been closed or moved
   gets its row corrected, not duplicated.

5. **Surgical.** Touch only these three things. Do not reword task bodies, do
   not renumber tasks, do not re-flow prose, do not tick or untick a checkbox.

6. **The `**Ticket:**` line is metadata, not a body revision.** `bd-plan`'s
   re-run rule un-checks any task whose body changed — adding or updating this
   line must not count as such a change. Note it in the Revision History entry
   so a later `bd-plan` run can tell the two apart.

Skip write-back entirely — and say which reason applies — when:

- `--no-writeback` was passed, or `--dry-run` stopped the run
- the source wasn't a plan file (an ad-hoc invocation with no file to write)
- the file isn't writable, or it changed on disk since Step 0

**A write-back failure must never swallow the keys.** If the edit can't be
made, print the full mapping table in chat and say the plan wasn't updated, so
the user can paste it in. Created tickets are the expensive artifact; the file
edit is the cheap one.

## Step 10: Report and Hand Off

```
Created:   N tickets (keys + type + summary)
Linked:    N links (A blocks B)
Rewritten: N existing (keys — old summary → new)
Deleted:   N (keys + summaries, permanently — recreated as: keys)
Closed:    N (keys → replacement)
Updated:   N existing overlaps (keys)
Skipped:   N duplicates kept (keys), N in-flight matches (keys)
Excluded:  N (reasons)
Stale:     N flagged for review (keys)
Failed:    N (with the error)
Plan:      <path> updated — N task annotations, Tickets table, Revision History
           (or: not updated — <reason>, mapping printed above)
```

Then offer, don't perform:

- Sub-task breakdown of the new Stories, if a skill for it is installed
- Grooming — estimates and sprint, deliberately left unset here
- Re-running bd-ticket after a plan revision (the dedupe pass makes it safe)

---

## Red Flags

- Creating anything before the Step 7 gate
- Skipping the dedupe pass because "the plan is new" — re-runs are the norm
- Inverting a blocks link (B depends on A ⟹ A blocks B — check every one)
- Inventing acceptance criteria the plan doesn't support
- Creating an Epic the user didn't ask for
- Setting estimates, sprint, or cycle
- Editing, closing, or deleting a ticket that's in flight
- Auto-closing a Stale ticket
- Resolving a duplicate silently — skipping one is a decision too, so ask
- Deleting on the strength of the Step 7 draft approval alone, without the
  second key-by-key confirmation
- Offering delete for a ticket with comments, links, sub-tasks, or a PR
- Rewriting a ticket without first showing the user the diff
- Falling back to close or rewrite when a delete fails
- Merging or re-splitting the plan's tasks without asking
- Hardcoding issue type names, link type names, status names, or field ids
  instead of discovering them
- Assuming a project key, a team's estimation scale, or a sprint cadence
- Decomposing tickets into sub-tasks
- Writing back before the tickets exist, or writing back a `--dry-run`
- Appending a second `**Ticket:**` line on a re-run instead of updating the one
  that's there
- Rewording task bodies, renumbering tasks, or touching checkboxes during
  write-back
- Letting a failed plan edit hide the created keys — print the mapping instead
- Writing bare ticket keys into the plan where a URL belongs

## Verification

Before the Step 7 gate:

- [ ] Plan resolved and read; task system announced with its deciding signal
- [ ] Project asked explicitly; epic detected or asked, never silently created
- [ ] Issue types, link types, and status names discovered from the instance
- [ ] Every plan task classified Story / Task / Bug, or excluded with a reason
- [ ] Dedupe run over keyword **and** structural passes, closed issues included
- [ ] Every duplicate resolved by the user — keep / rewrite / delete — with
      delete withheld where a guardrail applies, and the reason stated
- [ ] Every proposed rewrite shown as a diff before approval
- [ ] Every ticket has AC, or is marked `AC MISSING — needs input`
- [ ] Dependency graph acyclic; every link direction re-checked against
      "B depends on A ⟹ A blocks B"
- [ ] Estimates and sprint/cycle unset

Before finishing:

- [ ] User approved the draft explicitly (or `--dry-run` stopped the run)
- [ ] Deletions re-confirmed key-by-key at execution time, run stopped if any
      delete failed
- [ ] Only approved items created; links created after tickets
- [ ] Plan written back: every task annotated (including excluded and failed),
      `## Tickets` table with URLs, Revision History appended — or skipped with
      the reason stated and the mapping printed in chat
- [ ] Write-back was idempotent — no duplicated lines or rows on a re-run
- [ ] No task body, numbering, or checkbox altered by the write-back
- [ ] Report includes failures, stale, and excluded — not just successes
