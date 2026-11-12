# retro evals

`evals/scenarios/` holds six synthetic session transcripts, one per kind of session the
skill must handle. Each has one planted lesson, except `long-session`,
which has four so the deep-mode reviewers have different things to find. `evals.json` lists the expected mode and
what a good run finds for each one. The transcripts are made up, so they hold no company
data.

| Scenario        | The session                                                                                                       | Expected mode |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | ------------- |
| `review-round`  | Three new exports without tests, three corrections, three review comments                                         | single        |
| `broken-hook`   | The Bash hook fails from subfolders, then blocks a force push                                                     | single        |
| `pasted-review` | A pasted review comment about a direct `@mui/material` import, one mistyped workspace                             | single        |
| `quiet`         | A typo fix with nothing wrong                                                                                     | none          |
| `expensive`     | Five full CI logs dumped into the context, one file read three times                                              | single        |
| `long-session`  | Six untested exports flagged in review, a workspace name guessed six times, a pasted CI error, three full CI logs | deep          |

## Run the checks

- Script: `node --test ~/.claude/skills/bd-retro/scripts/*.test.mjs` checks that every scenario gets its
  expected mode.
- Skill: run each prompt in `evals.json` in a fresh session and stop at Step 5. Grade the
  output against its `expectations`.

## What the scenarios can't show

- Token cost: a synthetic transcript is too small to show the ticket's target of at most
  1/10 the tokens of a four-agent review. Measure that once on a real long session.
- Verdict agreement: compare the rubric's verdicts with real picks from the run log
  (`~/.claude/retro/monarch/log.jsonl`) after about ten real runs.
