# Solo mode (inline)

Entered from the dispatch gate (SKILL.md Step 3) when the operator picks **solo**, for small
work. You implement every remaining task in the plan, across all phases, yourself, in the
**current worktree**, on **one branch**, and open **one PR** based on trunk. Never stack, and
never open a PR per phase. No herdr, no stax, no crewmates, no run-dir state — just the plan
write-back at the end. The crew steps (`parallel-mode.md`) do not apply.

1. **Branch.** From the current worktree, cut one branch off trunk:
   `git fetch origin && git switch -c <branch> origin/<base>`, `<base>` = trunk. Name it as in
   the branch map (SKILL.md Step 2) but **one branch for the whole plan**:
   `<ticket-key-lowercase>-<short-slug>` if the plan carries a `**Ticket:**`, else
   `<plan-slug>`. ≤ 40 chars. If the
   worktree isn't clean, stop and hand it back — never build on someone else's uncommitted work.
2. **Implement task by task, in dependency order** across every phase (the topological order
   from SKILL.md Step 2, run sequentially — waves and checkpoints don't pause the run). A
   checkpoint's pause is skipped, not its checks: collect every check the plan's checkpoints
   list (deployed repro, scenario re-run, human review) and run them all once, after the last
   task, as part of step 3. For EACH task, follow [worker-brief.md](worker-brief.md)
   "How to work" steps 1–3 (guidance chain, test-first, verification gate). The verification
   gate must be green before the next task starts. Any departure from the plan — a file
   outside `Files:`, a changed signature, a plan assumption the code disproved — gets an
   `execute:deviation` row in the decision log as it happens.
3. **Finish steps**, once, on the whole diff. First run the collected checkpoint checks from
   step 2; one that cannot run is reported to the human as pending, never recorded as
   `skipped`. Then follow [finish-steps.md](finish-steps.md)
   with `<base>` = `origin/<base>`, `<proof-dir>` = `$(git rev-parse --git-dir)/bd-execute`
   (untracked, per worktree), `<id>` = `solo`, `<pr-template>` = the template found in
   preflight (SKILL.md Step 1.4), `<escalate>` = stop and ask the human.
4. **Commit and open ONE PR.** Commit on `<branch>`, `git push -u origin <branch>`, then
   `gh pr create --draft --body ""`. Post the
   body by following [finish-steps.md](finish-steps.md) "Post the PR body" with `<pr>` =
   `<branch>`, `<body>` = `$(git rev-parse --absolute-git-dir)/bd-execute/task-solo.pr.md`,
   `<recordings>` = this worktree's `.playwright-cli/recordings/`, `<parent>` = `origin/<base>`.
5. **Write back to the plan** (surgical, idempotent — bd-ticket's style): `**Branch:**` and
   `**PR:**` under each executed task heading, plus one Revision History line for the run.
6. **Babysit.** Run `/babysit-pr` on the new PR (or, if unavailable, poll `gh pr checks` and
   fix) until it is green; pause for the human on review feedback that changes intent.
7. **Report:** the one PR as a clickable link, one line per task on what it delivered, the
   minor findings, the babysit state, and the decision log's one-line summary. No stack, no
   tabs, no lanes to retire.

Solo mode edits code — that is the point — but it still obeys every **Never** (SKILL.md) that
isn't crew-specific: no merge, no rebase onto trunk, no force-push to a protected branch, and
**escalate high-risk surprises** (auth, secrets, payments, migrations, destructive ops)
instead of improvising.

## Before reporting done

- [ ] Every remaining task, across all phases, implemented on the one trunk-based branch, each
      past its verification gate
- [ ] `gates.sh` printed `review:ok verify:ok testing:ok|skipped pr:ok`
- [ ] One draft PR open, body posted from `task-solo.pr.md` with Demo files attached; plan annotated (Branch/PR + Revision History);
      `/babysit-pr` started
