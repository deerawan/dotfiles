# bd-write-skills — self baseline test

Applying the skill's own iron law to itself: RED (no skill) vs GREEN (with skill), same
task, fresh general-purpose subagents, 2 reps each, run 2026-09-10.

## Task given to every agent

> Create a Claude Code skill that helps Claude write concise, well-structured PR
> descriptions. Complaint: their PR descriptions keep coming out too long and bloated.

Chosen because the *correct* form is a positive recipe (a wrong-shaped-output failure),
so "did the agent match the form to the failure" is observable.

## Rubric — target behaviors the skill should induce

| Behavior | Baseline (2 reps) | With skill (2 reps) |
|---|---|---|
| Ran a watch-it-fail baseline before writing | 0/2 | 2/2 — `evals/` dirs written; rep 2 redid a too-weak baseline |
| Diagnosed the failure kind (wrong-shaped output) | implicit | 2/2 explicit |
| Matched form to failure (recipe, not prohibitions) | 0/2 — led with "Cut these"/"Never pad" lists | 2/2 — Shape + predicate-keyed budget + redirect table |
| Behavioral test before finishing | 0/2 — YAML parse only | 2/2 — RED vs GREEN word counts |
| Description = when-to-use | 2/2 (muted: both found `bd-pr` and echoed it) | 2/2 |

## Cost of the rigor (honest)

With-skill ≈ 72k tokens / 19 tool-uses / 250–326s per run; baseline ≈ 45k / 4 / 55–67s.
~1.6× tokens, ~4–5× wall-clock and tool-uses. That is the price of baseline+measure.

## Verdict

GREEN. The skill reliably and consistently changes the four behaviors it targets, verified
in artifacts (not just self-reports). No refactor: no new rationalization surfaced. The
description differentiator didn't separate — an environment artifact (baselines discovered
`bd-pr`), not a skill weakness.
