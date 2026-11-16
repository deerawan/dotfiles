---
name: bd-explain
description: >-
  Use when presenting something the user must decide or act on: a review
  comment or review row, a code-review finding, a CI or test failure, a bug's
  root cause, a design trade-off, or a choice between options. Also use when
  the user says "I don't understand", "elaborate", "explain simply", "in plain
  terms", or asks again because an explanation didn't land. Not for quick
  factual answers or status updates, and not for tightening existing prose
  (that is plain-english).
argument-hint: "[the finding, row, or decision to explain]"
---

# bd-explain

Shape an explanation so the reader can act after one read. The usual failure
isn't bad sentences. It's bad shape: the answer follows the source (the comment,
the log, the doc) instead of the reader's question, and it uses names the reader
never learned.

## The layout

Build the blocks in this order. Use plain labels. Drop blocks only as
"Scale it" allows.

1. **How it works today.** Two to four numbered steps, or the smallest sketch
   that shows the flow: a call tree, pseudocode, or a timeline. Introduce each
   name with what it does the first time it appears: "`ReportFindings`, a tool
   the reviewer fills in like a form".
2. **What's being raised.** One or two sentences in the reader's terms, naming
   who raised it (reviewer, CI, product).
3. **What I checked.** The evidence in your own words, then the verdict: true,
   false, or partly. A quote can back a point. It never is the point.
4. **An analogy.** Only when the idea is abstract, like a contract, timing,
   ordering, or a guarantee. One everyday picture, one or two sentences.
5. **A case table.** `Case | Today | After the fix`. Rows: the normal path, the
   case that breaks, and one case that stays the same, so the reader sees where
   the fix stops. Every row varies the same one thing, and each cell agrees
   with the prose. For a choice, use `Case | Option A | Option B`.
6. **The fix or recommendation.** One or two plain sentences first. Then, only
   if needed, the code. Shape it to the point: a flow diff when behavior
   changes, a file diff when text changes.
7. **The question.** One yes/no or pick-one question, last and on its own line.

When a caller has its own layout, such as bd-receiving-review Step 4.3, keep its
labels and fill them from this one: "What the code does today" takes block 1,
"Verified" takes blocks 2 to 5, and "Proposed fix" takes block 6.

## Scale it

Pick the smallest version that makes the point clear.

| Situation | Use |
|---|---|
| Concrete, obviously true (a typo, a missing null check) | Blocks 2, 3, 6, 7, one line each |
| One cause, no options, concrete | Skip the analogy. A two-row table if it helps |
| Abstract mechanism, options, or a guarantee at stake | Full layout |
| A quick fact or a status update | Don't use this skill |

## Words

- Gloss every identifier, acronym, and term of art the first time, or replace
  it. Test: could a sharp engineer from another team follow it cold?
- One idea per sentence, short sentences. For sentence-level rules, see
  plain-english and bd-technical-writing. This skill doesn't repeat them.
- Lead each block with its point, not its source.
- Answer what was asked. Mention extra findings or follow-up work in one line
  at most.

## Example

A reviewer says a self-review skill wrongly reports "review did not run".

Dense first try, which the reader couldn't use:

> **Verified:** True. `ReportFindings` desc: "Use this only when the active
> code-review instructions tell you to..." so text output is possible. Also
> `EFFORT` is already known, so returning the level is redundant.
> **Proposed fix:** (diff)

The same row with this layout:

> **How it works today:**
> 1. self-review starts a subagent, and the subagent runs `/code-review`.
> 2. `/code-review` usually hands back findings through `ReportFindings`, a
>    tool it fills in like a form.
> 3. Step 5 says: no form means the review didn't run. self-review then writes
>    no report and stops.
>
> **What the reviewer says:** some models finish the review but write findings
> as plain text. Step 5 calls that "didn't run", so a finished review is thrown
> away.
>
> **What I checked:** the form tool's own instructions say to use it only when
> asked to, and otherwise to answer in whatever format was asked for. So a
> finished review can come back as text. The reviewer is right.
>
> It's like a teacher who only accepts homework on the official worksheet. A
> student who did the work on plain paper gets marked "didn't do it".
>
> | Case | Today | After the fix |
> |---|---|---|
> | Review ran and filled in the form | Report written | Report written |
> | Review ran and wrote findings as text | No report, "did not run" | Report written from the text |
> | Review crashed or never started | No report, "did not run" | No report, "did not run" |
>
> **The fix:** in step 5, accept findings from the form or from the text, and
> say "did not run" only when the review didn't start or didn't finish.
>
> `.claude/skills/self-review/SKILL.md:43`
> ```diff
> -5. Return the level and the number of findings from the `ReportFindings` call ...
> +5. Return the number of findings, from the `ReportFindings` call or from its text output ...
> ```
>
> Apply this fix?

## Never

- Use a name, acronym, or term the reader hasn't seen without saying what it is.
- Show a diff or code before saying the fix in plain words.
- Let a quote stand in for the evidence. Say what it means.
- Order the answer by the source (comment order, log order) instead of the
  reader's question.
- Bury the decision. The question comes last, alone.
