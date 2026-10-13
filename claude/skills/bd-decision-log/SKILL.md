---
name: bd-decision-log
description: Use when a run makes calls on its own that the operator may want to audit later — loaded at the start of bd-plan and bd-execute, and by any autonomous or multi-phase work that skips an approval. Also use when the user asks to see, review, or audit what an agent decided, or runs /bd-decision-log <topic>.
argument-hint: "[plan topic or log path] [--phase <prefix>] [--flagged]"
---

# bd-decision-log

An append-only TSV trail of every call an agent made without asking. bd-plan and
bd-execute no longer stop for approval, so this file is how the operator reviews those
calls after the fact. Two modes: **Log** (loaded by another skill) and **Review** (the
user runs `/bd-decision-log <topic>`).

## The file

`~/.claude/plans/<plan-slug>.decisions.tsv` — beside the plan, same slug. bd-plan uses the
kebab topic it will save the plan under; bd-execute uses the resolved plan path with
`.md` replaced by `.decisions.tsv`. One file per plan, across every run and every
`.vN` revision.

| Column | Holds |
|---|---|
| `ts` | UTC timestamp — the script stamps it |
| `phase` | `<skill>:<step>` — `plan:depth`, `plan:explore`, `plan:design`, `plan:review`, `plan:assume`, `execute:mode`, `execute:answer`, `execute:deviation` |
| `decision` | what was chosen, one line |
| `why` | the reason it won, one line |
| `evidence` | a pointer — `file:line`, ticket AC, PR link, commit SHA, plan section. Never a paragraph |
| `result` | outcome — `picked`, `fixed`, `dropped`, `deferred`, `relayed`, `operator chose X` |

## Log mode

Append each row **at the moment of the decision**:

```bash
~/.claude/skills/bd-decision-log/scripts/log.sh <logfile> <phase> <decision> <why> <evidence> <result>
```

The script stamps `ts`, writes the header on first use, flattens tabs and newlines, and
neutralizes cells a spreadsheet would run as a formula. Use it rather than `printf`.

**What earns a row** — any call the operator could have made and might reverse:

- a classification (depth, simple vs complex exploration, solo vs crew recommendation)
- a pick between options (a design, a branch layout, a wave split)
- a review finding fixed, dropped, or deferred to Open Questions
- an assumption about the codebase that grounding could not confirm
- a deviation from the plan, and how it was handled
- an answer given on the operator's behalf (a crewmate's `blocked` question, a relay)
- a step skipped, with why

Not a row: reads, mechanical steps, anything the operator explicitly told you to do.

**One `<skill>:start` row opens each run** (`decision` = what this run is, e.g. `phase 1,
crew`), so re-runs stay separable in one append-only file.

**Before handing back**, re-read this run's rows against what actually happened in the
conversation. A row that is wrong gets a new `<skill>:correction` row pointing at it by
`ts` — never edit or delete an earlier row. Then end the hand-back with one line:

```text
Decisions: 7 logged (1 design pick, 2 review fixes, 1 dropped, 1 assumption) → ~/.claude/plans/<slug>.decisions.tsv
```

## Review mode

Resolve `$1` like bd-execute does (a path, or a topic globbed in `~/.claude/plans/`, ask
on multiple hits), then render:

```bash
column -t -s $'\t' <logfile>                                   # whole log
awk -F'\t' 'NR==1 || $2 ~ /^<prefix>/' <logfile> | column -t -s $'\t'   # --phase
awk -F'\t' 'NR==1 || $6 ~ /dropped|deferred|correction|operator/ || $2 ~ /assume|answer|deviation|correction/' <logfile> | column -t -s $'\t'   # --flagged
```

`--flagged` shows the rows most worth a human look: dropped findings, deferred calls,
assumptions, answers given for the operator, deviations, and corrections. After the table, list any row whose `evidence`
is empty or prose instead of a pointer — those are the weakest calls in the log.

## Never

- Batch rows at the end of a run from memory — the trail is only trustworthy if written
  as it happens.
- Edit or delete an existing row; correct by appending.
- Log the operator's own instructions as your decision.
- Put a paragraph in `evidence`, or leave `why` empty.
- Write the log anywhere but beside the plan — a log in a worktree is lost with it.
