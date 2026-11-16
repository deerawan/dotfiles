# Row 9 of 15 in a review round on a PR

You are processing review comments on a PR. You verified this row already; the findings below are all true.

## The comment (coderabbitai[bot] on `.claude/skills/self-review/SKILL.md:43`)

> **Do not report a completed text review as "not run."**
>
> Step 5 returns `Review did not run` whenever `code-review` does not call `ReportFindings`. The Claude Code maintainer states that some models report findings as text without that call, by design. For those models, a completed review is reported as not run, and `/self-review` writes no report.
>
> Accept findings from a completed review when they arrive as text. Return `Review did not run` only when the review itself did not complete.

## Context

self-review spawns a fresh subagent that runs the built-in `/code-review EFFORT --fix TARGET`. EFFORT is the level (medium/high) that self-review picked in its step 3 and passes in.

Step 5 of the subagent's instructions, line 43 today:

> 5. Return the level and the number of findings from the `ReportFindings` call of `code-review`. If `code-review` did not run, or did not call `ReportFindings`, return `Review did not run: REASON` and nothing else.

Line 45: "When the subagent returns `Review did not run`, write no report. Tell the user the reason and stop."

The `ReportFindings` tool description reads: "Report code-review findings as a typed list so the host UI can render them. Use this only when the active code-review instructions tell you to report findings with this tool; otherwise follow whatever output format those instructions specify."

## Your verification result

True. ReportFindings is conditional by its own description, so a finished review can come back as text. Also, step 5 asks the subagent to return the level, but self-review already knows it because it passes EFFORT in.

Proposed fix: line 43 becomes "5. Return the number of findings, from the `ReportFindings` call of `code-review` or from its text output when it reports findings as text. If `code-review` did not run or did not finish, return `Review did not run: REASON` and nothing else."

Draft reply: `Fixed in <sha>.`
