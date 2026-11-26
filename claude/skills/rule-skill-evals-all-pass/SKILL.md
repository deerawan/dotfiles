---
name: rule-skill-evals-all-pass
description: "Apply whenever you write, convert, run or report a skill's eval suite (`claude plugin eval`, skill-creator case folders, evals.json). Every case ships at 1.00. A case that scores less gets its trace read, then its grader fixed or the case deleted; never a lower threshold, and never a suite that only passes on retry."
user-invocable: false
---

# Skill Evals All Pass

A skill's eval suite ships only when every case scores 1.00 in a full run. Run it with the default threshold (1.0, no `--threshold` flag), so the exit code enforces that: exit 0 means every case scored 1.00.

**Why:** A suite that sometimes exits 1 teaches people to ignore it, and then a real regression goes unnoticed. In one session, every miss whose trace was read (14 of them) came from grader wording, a too-narrow regex or a simulation that gave the answer away. None came from the skill. Without the traces, each would have been taken as a skill bug.

## When a case scores below 1.00

1. **Read the run.** Rerun only that case with `--ablation none --keep-temp --runs 5`, then read the failing run's final message from its `trace.jsonl`. Never fix a grader from its name.
2. **Decide what failed:**
   - **The plan was right and the grader misread it:** reword the grader as one checkable statement, naming what is allowed ("saying it won't run X is fine"). Check a new regex offline against every kept run before you rerun the case.
   - **The skill was wrong:** keep the failing case. Fix the skill in its own change, because a guidance change needs a failing eval.
   - **The simulation can't test it** (the answer is given in the prompt, or it needs a second turn): change the simulation so it can be tested, or drop that grader.
   - **It still varies after one fix:** delete the case. Don't reword a second time to chase the judge.
3. **Rerun the full suite.** The evidence is that run, not the single-case rerun.

## Grader choices that remove noise

- Checking that a command or string appears: use a `regex` grader. Allow line breaks and prose forms (`by executionId` as well as `executionId==`).
- "Runs no X" in a dry run: use an `llm` grader, because the plan often names X to say it won't run it.
- Add one negative control per skill: a nearby question with `tool_used: Skill`, `max: 0`, `arm: both`.
- A case whose no-skill run also scores 1.00 tests nothing the skill teaches. Rewrite it or drop it.

## Never

- Pass `--threshold` below 1.0 to make a suite pass.
- Ship a suite on a rerun that happened to pass while the failing run went unread.
- Report a suite as passing when a case scored below 1.00.
