# Finish steps

Run these once implementation is past its verification gate. Both modes use them: the crew
brief and solo mode each give the values below. Proof files land in `<proof-dir>`; `gates.sh`
checks them, and in crew mode `write-status.sh done` refuses without them.

| Input | Meaning |
| --- | --- |
| `<base>` | the branch this work stacks on |
| `<proof-dir>` | where the proof files go |
| `<id>` | the task id in proof file names |
| `<pr-template>` | the repo's PR template path, or "none" |
| `<escalate>` | what to do with a decision that isn't yours |

1. Self-review the full diff: `git diff <base>...HEAD` — scope creep, YAGNI, leftover debug.
2. **Code review** — invoke `bd-code-review` on your working tree, before you commit. Fix every
   Critical and Important `auto-fix` finding, then re-run it with `incremental` until the verdict
   is not `request-changes`. A Critical or Important `ask-user` finding is not yours to decide:
   <escalate>. Save the final run's `bd-code-review-verdict` block to
   `<proof-dir>/task-<id>.review.md`, verbatim. Keep the Nitpicks for your report.
3. **Domain testing** — check your session's available agents and skills for any tester
   whose domain matches what you changed. If one matches, dispatch it against your change;
   if it reports failures, fix and re-run. Save its FULL structured report to
   `<proof-dir>/task-<id>.testing.md` — verbatim, never summarised, so the human can read the
   real thing. If none matches, write that fact in the file instead.
   Never fabricate a report. **The full report does not go in the PR body** (see next step).
4. Write your PR body to `<proof-dir>/task-<id>.pr.md`. This file IS the PR body; nothing
   else fills it.
   - **Invoke the `bd-pr` skill first** and follow its budget. If it isn't available in
     your session, apply this: a PR body is a decision aid, not a work log —
     ~150–300 words for a normal task, and **always shorter than the diff it describes**.
     Count it (`wc -w`) before you finish; don't estimate.
   - Fill the repo's template at `<pr-template>` (if it is "none", write
     Problem / Solution / Acceptance Criteria / Testing). **Copy the template's structure
     faithfully — every heading in its original order, and every HTML comment marker
     verbatim**, including ones that look like empty placeholders: CI can inject content into
     those markers, and dropping them silently breaks it.
   - **Demo/Screenshots section** (whatever heading the template uses): screenshots or a
     recording for a UI change, or one line saying there's no user-visible change. Never empty.
   - **Testing section: results, not transcripts.** One line per check — what you ran and
     that it passed. The full tester report lives in `task-<id>.testing.md`; reference
     it, don't paste it.
   - **Never in a PR body:** command output or logs, test-run transcripts, a narration of
     your commits or of what you tried first, restatements of the diff, or the plan task
     pasted back. The reviewer has the diff; they need why it exists and what could go wrong.
   - If `<base>` is not `main`, add the line:
     `Stacked on \`<base>\`; re-target to main once that merges.`

Check the gates. Every field must be `ok`:
`~/.claude/skills/bd-execute/scripts/gates.sh <proof-dir> <id>`
