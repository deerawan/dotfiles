---
name: bd-pr
description: Writes and trims pull request descriptions against a word budget so the body stays a decision aid rather than a work log. Use whenever a PR description is being composed, updated, or trimmed — including from inside /pr, /babysit-pr, `gh pr create` and `gh pr edit` — and when the user says a PR is too long, verbose, bloated, or hard to read, asks to shorten a PR description, or runs /bd-pr. Invoke BEFORE writing any PR body text, not after.
---

# bd-pr

A PR description is a decision aid, not a work log. Its only job is to help a reviewer decide, quickly and correctly, whether this should merge. Every sentence that doesn't move that decision is a tax on it.

Reviewers get through at most 20-28% of a page and 79% scan rather than read, so writing 4x as much doesn't transfer 4x as much. It transfers less reliably, because the paragraph that matters is now competing with forty that don't. Length also reads as doubt: 5,000 words on one SQL view tells a reviewer the author isn't sure it's right.

## Plain language comes first

The goal is that the reviewer understands the change. The budget below is a means to that, not the point. A short description packed with jargon fails just as hard as a long one, and cutting words without making the meaning clearer is wasted effort.

This applies to **Problem, Solution, Acceptance Criteria and Testing**. Demo and Resources are images and links, so they're exempt.

Write those sections for a competent engineer who has none of your context: they weren't in the ticket, haven't read the design doc, and don't know what you tried first.

- **One idea per sentence.** If a sentence has two clauses joined by "and" or a semicolon, it's usually two sentences.
- **Concrete over abstract.** "The view returns every seller's rows" beats "seller scoping is delegated to the repository layer." Say the thing that happens, not the architectural category it belongs to.
- **Expand or link the first use** of any acronym, internal term, role name or table name a reviewer outside your squad wouldn't know.
- **Say what breaks if this is wrong**, in terms of what a person would see, not what a system would do. "A customer sees an order that was deleted" beats "a missed predicate degrades data integrity."
- **No hedging chains.** "It should generally be the case that" is "usually".
- **Don't make them hold three things at once** to parse one sentence. Nested clauses and back-references ("the former", "as noted above") force a re-read.
- **Cut the qualifier if the sentence survives it.** Most do.
- **Prefer a table, list or code block over a paragraph** when it scans faster. Words in a table are cheap to scan; the same words in prose are not.
- **Keep it factual.** Don't repeat in prose what the Requirements or Testing checkboxes already say.

Test it like this: could a reviewer from another squad read Problem and Solution once, at speed, and correctly say what changed and what could go wrong? If not, simplify the words before you cut them.

## The budget (check this, don't estimate it)

Count before `gh pr create` or `gh pr edit`. Write the body to a file first, then:

```bash
# words in the body you are about to post (strip any bot-managed marker blocks first)
wc -w < body.md
# lines of code the PR actually changes
git diff --shortstat "$(gh pr view --json baseRefName -q .baseRefName)"...HEAD
```

| Change | Budget |
| --- | --- |
| Trivial: config, copy, a version bump, a constant | under 40 words |
| Normal: one self-contained change | 150-300 words |
| Risky: auth, migrations, grants, money, deletion, RLS | up to 450; name the risk and blast radius in Solution |
| Bigger than that | Cut it, or split the PR |

Two hard rules:

1. The body must be shorter than the diff. Always. If the prose outruns the code, the reviewer either skips the prose (wasting all of it) or reads it instead of the code (worse).
2. Past 450 words you are writing a log, not a description. Aim for about 300 words on a normal change; that is the target, not the floor.

This is a **word** budget, not a byte budget. Screenshots, recordings and diagrams don't count against it, because they don't consume reading attention the way prose does. Prose is what gets cut.

## Start from the repo's template

Read the template fresh before writing — don't rely on a remembered version, it may have changed:

```bash
cat .github/pull_request_template.md
```

(If that path is missing, check `docs/pull_request_template.md`, the repo root, and `.github/PULL_REQUEST_TEMPLATE/`.)

Use it as the exact base for the body: keep its headings and their order, and map the shape below onto its sections. If the repo has no template, use the shape below as the structure.

## Shape

1. **Problem**, two sentences. Why this change exists.
2. **Solution**, three to five sentences. What changed and why, not how. The reviewer can read how.
3. **Acceptance Criteria** and **Testing**, one line per checkbox. Never a paragraph inside a checkbox.
4. **Resources**: ticket, design doc, dependent PRs. Link the published design doc, not a local `*.md` path.
5. **Demo/Screenshots** (use whatever heading the repo's template uses), in the body, not a comment. See below. If there's no user-visible change, one line saying so.

Reuse the commit message. A well-written commit already leads with the decision and explains the why, so the Problem and Solution sections are usually that message lightly edited.

## Examples by size

Scale the prose to the change. These are complete Problem + Solution sections, not excerpts.

Trivial:

> **Problem:** The Datadog RUM sample rate is 100% in prod, which burns quota on sessions nobody looks at.
>
> **Solution:** Drops it to 20%.

Normal:

> **Problem:** The order analytics view groups by `order.company_id`, which is the seller, so buyer dashboards double-count orders that span two buyers.
>
> **Solution:** Groups by the buyer id from the joined order instead and extends the composite index to cover it. No API change; the resolver already passes the buyer through.

Restructure (many files moved): keep the prose to why, and put the moves in a table.

> **Problem:** GraphQL resolver files sit in three folders, so every new resolver touches all three.
>
> **Solution:** Consolidates them under `applications/graphql/`. Imports updated, no logic changes.
>
> | Before | After |
> | --- | --- |
> | `applications/api/resolvers/` | `applications/graphql/resolvers/` |
> | `applications/api/schema/` | `applications/graphql/schema/` |

## Where everything else goes

| Content | Goes to | Not the body because |
| --- | --- | --- |
| Why the code is shaped this way | a code comment | the next reader is in the file |
| Alternatives considered, rejected designs | the design doc | already written and linked |
| Testing evidence: tester/agent reports, test output, EXPLAIN plans, migration logs | the demo/screenshots section | evidence belongs with the demo, where reviewers look first |
| How you handled review feedback | a reply on the thread | pre-empts the reviewer and duplicates the thread |
| An unrelated CI failure | its own ticket, one link | not this PR's argument to make |
| Debugging path, dead ends, what you tried first | nowhere | doesn't change the merge decision |
| Demo screenshots and recordings | **the body**, in the demo/screenshots section | images cost no reading budget, and it's the first thing a reviewer opens |

Never paste raw command output or long reports inline as prose. If text evidence matters, put it in the demo/screenshots section inside a collapsed `<details>` block — collapsed blocks don't compete for reading attention, so they don't count against the budget — and keep the Testing checkboxes to one line each pointing at it.

## Demo/Screenshots

Repos name this section differently: `## Demo`, `## Screenshots`, `## Evidence`. Use the heading the repo's template uses; the rules below are the same regardless of the name.

It goes in the body, not a comment, because the budget caps words and a screenshot isn't words. It's also the first thing a reviewer opens on a UI change, and a comment is easy to miss. Testing evidence lands here too (see the table above).

The cap is on volume, not placement:

- **In the body:** up to about three images, or one short recording, showing the change itself. Before/after pairs count as one. Long text evidence goes in a collapsed `<details>` block.
- **In a comment:** full walkthroughs, per-state galleries, multi-viewport sets, raw automated browser-test runs. Leave one line in the section pointing at the comment.
- **No user-visible change:** say exactly that in one line. Don't delete the heading, and don't pad it with an explanation of why there's nothing to show.

Never move a demo/screenshot section the user added by hand out of the body, and never replace their screenshots with your own description of them.

## Updating an existing body

If the PR is already open, never blindly overwrite its body — the human may have edited it by hand since you last saw it. Always fetch the live body from the remote first, compare it against what you have, and splice your edit into the fetched version:

```bash
gh pr view --json title,body
```

Never regenerate from scratch, and never edit from a locally cached copy. Preserve:

- any bot-managed block delimited by HTML comment markers (badge headers, CI or infra preview blocks) — keep them byte-for-byte
- any demo/screenshot images, recordings or prose the user added by hand
- the author's own structure and wording — if the fetched body differs from what you last wrote, the human edited it; keep their version and make the minimum edit needed

If a section has grown past its budget since the last edit, trim it in the same pass.

## Voice

PR descriptions are prose written on the user's behalf, so follow `~/.claude/VOICE.md`. In particular: contractions, short declarative sentences, conclusion first, no em dashes, no bold for emphasis, emoji sparingly.

## What not to do

These patterns force the reviewer to reverse-engineer the PR, and each is a reason to send it back:

- **Diff narration.** Listing what changed file by file ("renamed X to Y", "moved the hook", "updated imports") restates the diff in worse detail. Say why the change was made; the reviewer can read what it did.
- **Context-free rewrites.** A restructure or rewrite whose Problem section doesn't say what prompted it forces the reviewer to reverse-engineer intent from the diff.
- **Cross-package changes without explanation.** If the PR touches more than one app, package or domain, spend one sentence on why they move together. Unrelated-looking changes with no stated connection are a red flag.
- **Template placeholders left in.** Never post placeholder items like `Requirement A`, unfilled link stubs, or the template's own instruction text. Fill each section or replace it with one line saying it doesn't apply.
- **Unchecked noise in the checklists.** Delete Requirements and Testing items that don't apply instead of leaving them unchecked; the reviewer uses what remains to verify coverage.

## Before posting

- Could a reviewer from another squad read Problem and Solution once and say what changed and what could go wrong?
- Is every acronym, role name and table name expanded or linked on first use?
- Is the body shorter than the diff?
- Can a reviewer find the one risky thing in five seconds without scrolling?
- Is anything here a record of what I did rather than what a reviewer needs?
- Does any fact appear twice? Keep the copy closest to the code.

## Grounding

- [Writing good CL descriptions](https://google.github.io/eng-practices/review/developer/cl-descriptions.html) and [Small CLs](https://google.github.io/eng-practices/review/developer/small-cls.html), Google Engineering Practices
- [Code Review at Cisco Systems](https://static0.smartbear.co/support/media/resources/cc/book/code-review-cisco-case-study.pdf), SmartBear: detection falls off past 400 lines under review
- [Expectations, Outcomes, and Challenges of Modern Code Review](https://sback.it/publications/icse2013.pdf), Bacchelli & Bird ICSE 2013: understanding the change is the reviewer's hardest problem
- [How Little Do Users Read?](https://www.nngroup.com/articles/how-little-do-users-read/), Nielsen Norman Group
