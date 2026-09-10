# Solo mode (inline)

Entered from the dispatch gate (SKILL.md Step 3) when the operator picks **solo**, for a small
phase. You implement every selected task yourself, in the **current worktree**, on **one
branch**, and open **one PR**. No herdr, no stax, no crewmates, no run-dir state — just the plan
write-back at the end. The crew steps (`parallel-mode.md`) do not apply.

1. **Branch.** From the current worktree, cut one branch off the phase's base — trunk, or the
   phase's single unmerged dependency branch if it stacks on earlier work:
   `git fetch origin && git switch -c <branch> origin/<base>`. Name it as in the branch map
   (SKILL.md Step 2) but **one branch for the whole phase**: `<ticket-key-lowercase>-<short-slug>`
   if the phase carries a `**Ticket:**`, else `<plan-slug>-<phase-slug>`. ≤ 40 chars. If the
   worktree isn't clean, stop and hand it back — never build on someone else's uncommitted work.
2. **Implement task by task, in dependency order** (the topological order from SKILL.md Step 2,
   run sequentially — waves don't apply). For EACH task, hold the same bar the worker brief sets
   ([worker-brief.md](worker-brief.md), "How to work"):
   - Read the repo's `AGENTS.md`/`CLAUDE.md` chain for every directory you touch.
   - Test-first: write the task's test scenarios as failing tests, then make them pass. Stay
     within the task's `Files:` list; note any file you must touch outside it.
   - **Verification gate before the next task:** the task's own `Verification:` command, the
     full suite for every package you touched, and the repo's compile/typecheck gate. Any red
     means you are not done — fix before moving on.
3. **Review the whole change** once every task is in: `git diff origin/<base>...` for scope
   creep, YAGNI, leftover debug — then `/pr-review-toolkit:review-pr`. Fix every Critical and
   Important finding it confirms; keep the minor ones for the report.
4. **Domain testing** — dispatch any tester agent or skill whose domain matches what you
   changed; fix failures and re-run. Keep its report for the PR's Testing section (results,
   not transcripts).
5. **Commit and open ONE PR.** Commit on `<branch>`, `git push -u origin <branch>`, then
   `gh pr create --draft`. Write the body with **`bd-pr`** — fill the repo template discovered
   in preflight (SKILL.md Step 1.4; free-form Problem / Solution / Testing if none), a decision
   aid shorter than its diff. If `<base>` isn't trunk, set the PR base to it and add the line
   `Stacked on \`<base>\`; re-target to main once that merges.`
6. **Write back to the plan** (surgical, idempotent — bd-ticket's style): `**Branch:**` and
   `**PR:**` under each executed task heading, plus one Revision History line for the run.
7. **Babysit.** Run `/babysit-pr` on the new PR (or, if unavailable, poll `gh pr checks` and
   fix) until it is green; pause for the human on review feedback that changes intent.
8. **Report:** the one PR as a clickable link, one line per task on what it delivered, the
   minor findings, and the babysit state. No stack, no tabs, no lanes to retire.

Solo mode edits code — that is the point — but it still obeys every **Never** (SKILL.md) that
isn't crew-specific: no merge, no rebase onto trunk, no force-push to a protected branch, and
**escalate high-risk surprises** (auth, secrets, payments, migrations, destructive ops)
instead of improvising.

## Before reporting done

- [ ] Every selected task implemented on the one branch, each past its verification gate
- [ ] Whole diff reviewed (`/pr-review-toolkit:review-pr`); confirmed Critical/Important fixed
- [ ] One draft PR open, body via `bd-pr` and shorter than its diff; plan annotated (Branch/PR
      + Revision History); `/babysit-pr` started
