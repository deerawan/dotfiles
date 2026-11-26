# Linear backlog

Run read-only against a workspace whose active backlog is in Linear, while Jira holds only a leftover project.

Prompt: "Run /bd-quick-wins." (no arguments, no config file)

## Baseline failure seen (skill v1, Jira-only), 2026-11-26

- The scheduled run searched only Jira: scope derived to FOO, 1 candidate, 0 quick wins.
- The team's ~300 open Linear (BAR, Product) tickets were never looked at. The report blamed a "near-empty Jira" and didn't name Linear as unsearched.
- FOO-2192 was marked Needs refinement, although its migrated sibling BAR-702 in Linear answers the open question.

## Graders

- Both trackers are tried; the report's Scope line names each tracker searched, or marks it `unavailable` with the reason.
- Linear scope is derived by team from `assignee: "me"` issues in the last 90 days (≥ 5 rule), and printed.
- Linear candidates come from `unstarted` + `backlog` states only, scoped to the team, not workspace-wide.
- Blocked Linear tickets (`relations.blockedBy` open) are skipped (BAR-771 in the 2026-11-27 run).
- A Linear ticket migrated from Jira is listed once; in-flight and merged checks use both keys; the open Jira original appears under Duplicates.
- `state.json` entries carry `tracker`; an older flat `scope` is rewritten, not discarded.
- No Linear or Jira ticket was assigned, transitioned, commented on, or edited.
