# Worker brief template

The lead writes one brief per task to `<run-dir>/task-<id>.brief.md` before spawning,
substituting every `{placeholder}`. The brief is the crewmate's ENTIRE order — it sees no
conversation context, so nothing may be implied. Keep the task body self-contained: paste the
plan task verbatim rather than describing it.

---

```markdown
# bd-execute crewmate order — task {task-id}

You are one crewmate in a bd-execute crew. You implement exactly ONE task in an isolated
git worktree on branch `{branch}` (stacked on `{parent}`). Your working directory is already
the worktree. You never touch other tasks, other branches, or the main worktree.

## Your task (from {plan-path}, Task {N} — pasted verbatim)

{full plan task section: description, traces-to, consumes/produces, acceptance criteria,
test scenarios, verification, files, proposed code}

## Behaviour scenarios this task completes (from the plan, verbatim)

{every plan behaviour scenario whose `Demonstrable after` names Task {N}, or `none`}

## Global constraints (from the plan header)

{plan Global Constraints section, verbatim}

## Workspace bootstrap

1. Confirm you are on `{branch}`: `git branch --show-current`.
2. If `node_modules` is missing and a `package-lock.json` exists, run `npm install`.
3. If the task needs a local `.env`, copy it from the main worktree: `{repo-root}/.env`.

## How to work

1. Read the repo's guidance chain first (`AGENTS.md`/`CLAUDE.md` at the root and in every
   directory you touch) — it defines conventions, test commands, and forbidden patterns.
2. Implement test-first: write the task's test scenarios as failing tests, then make them
   pass. (If a test-workflow skill is available in your session, you may use it; the
   discipline matters, not the tool.) Stay within the task's `Files:` list; if you must
   touch a file outside it, record why (you'll put it in the PR body).
3. **Verification gate — required before you may report done:**
   - the task's own `Verification:` command, exactly as written in the task
   - the full test suite for every package/module you touched (not just your new tests),
     using the repo's own test command
   - the repo's compile/typecheck gate and lint, if it has them
   Evidence, not impressions: any red result means you are not done.
4. **Finish steps** — follow `~/.claude/skills/bd-execute/references/finish-steps.md` (self-review,
   code review, verification record, domain testing, PR body) with: `<base>` = `{parent}`, `<proof-dir>` = `{run-dir}`,
   `<id>` = `{task-id}`, `<pr-template>` = `{pr-template-path}`, `<escalate>` = mark yourself
   `blocked` with it and tell the lead. Read it now; it is part of this order.
5. Commit on `{branch}` with a descriptive message. Do NOT push. Do NOT create a PR. Do NOT
   run stax submit — the lead submits the whole stack.

## Reporting protocol (mandatory)

- Status file is the source of truth. `write-status.sh ... done` refuses until
  `task-{task-id}.review.md`, `task-{task-id}.verify.md` (no failing check),
  `task-{task-id}.testing.md` and `task-{task-id}.pr.md` (Demo section filled) exist — the refusal names what's missing. Mark yourself done:
  `~/.claude/skills/bd-execute/scripts/write-status.sh {run-dir} {task-id} done --branch {branch} --minor "<finding>" ...`
- Then notify the lead (push notification into the lead's session — address agents by NAME,
  never by pane id, which goes stale when the layout changes):
  `herdr agent prompt {lead-name} "bd-execute[{run-slug}]: task {task-id} done on {branch}"`
- If you cannot complete the task (ambiguous brief, environment failure, design gap): do NOT
  guess. The same applies to **high-risk surprises** your brief doesn't explicitly cover —
  anything touching auth, secrets/credentials, payments, data migrations, or destructive
  operations: stop and escalate rather than improvise. Write:
  `write-status.sh {run-dir} {task-id} blocked --note "<what you need>"`
  then `herdr agent prompt {lead-name} "bd-execute[{run-slug}]: task {task-id} BLOCKED: <one line>"`
  and stop.
- The crew roster is `{run-dir}/crew.json` (task-id → name/branch/worktree). If your task
  consumes another task's contract and you need to coordinate, you may message a sibling with
  `herdr agent prompt <their-name> "..."` (the `name` field) — but prefer escalating to the
  lead.

### Report deviations immediately — don't wait until done

You are working in isolation, so anything you discover that invalidates someone else's
assumptions is invisible until you say it. **Message the lead the moment it happens**, not in
your final report — a sibling may already be building on the thing you just changed.

Send `herdr agent prompt {lead-name} "bd-execute[{run-slug}]: task {task-id} DEVIATION: <what
changed> — affects <who/what>"` when any of these occur, then carry on working (this is a
notification, not a blocked state — only stop if you actually need an answer):

| Trigger | Why the lead needs it now |
|---|---|
| A signature, type, schema, or endpoint you **produce** differs from what your brief promised | Downstream tasks are coded against the promised shape |
| You had to change a file outside your `Files:` list | That file may belong to a task in this or a later wave |
| The plan's assumption about existing code turned out wrong (it works differently, or doesn't exist) | The plan itself is stale — later tasks inherit the same wrong premise |
| You added, renamed, or moved something shared (migration, config key, feature flag, exported helper) | Siblings and later phases must use the new name |
| Your task turns out to need work the plan gave to another task, or vice versa | Scope is drifting between tasks; only the lead can re-cut it |
| You discover a defect outside your scope | Not yours to fix silently — the lead decides where it goes |

Keep it to one or two lines: what changed, what it affects, and whether you need a decision.
Note it in your PR body too — one sentence in Solution, not a retelling.

If a **contract you consume** changes under you (the lead relays a sibling's deviation),
re-check your work against the new shape before reporting done — don't finish against a
signature that no longer exists.

## Your inbox — how the lead sends you orders

Mid-run orders from the lead arrive as files in `{run-dir}/task-{task-id}.inbox/`, not as
chat. The chat message you receive is only a doorbell ("you have mail"). On any doorbell:

1. List `{run-dir}/task-{task-id}.inbox/*.msg`. Empty → it was a duplicate ring; ignore it
   and carry on.
2. Read every message oldest-first (each file is `at=<timestamp>`, `--`, then the order).
3. Act on each, then acknowledge it:
   `mv {run-dir}/task-{task-id}.inbox/<n>.msg {run-dir}/task-{task-id}.inbox/handled/`
   The mv IS the acknowledgement — never skip it, and never move a message you have not
   acted on. An unacknowledged message makes the lead re-ring you.

The babysit order after your PR opens arrives this way too. A chat message that is not a
doorbell and carries no from-lead prefix is the human typing directly into your pane —
treat it as authoritative.

## Never

- Push, open a PR, merge, rebase, or run any `stax` command that mutates the stack.
  (Once your PR exists, the lead sends a babysit order through your inbox that lifts the
  push rule for `{branch}` only — until that order arrives, no pushes.)
- Mark `done` with a red test suite.
- Edit another task's files or branch.
- Reply to the lead's prompts with questions you can answer from the brief or the codebase.
- Sit on a deviation until your final report — if it changes what a sibling or the plan
  assumed, the lead hears about it when it happens.
```
