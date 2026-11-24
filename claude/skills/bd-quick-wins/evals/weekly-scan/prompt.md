# Weekly scan

Run the same prompt with and without the skill against a real Jira site, read-only.

Prompt: "Find quick wins in my Jira backlog: open tickets assigned to me or unassigned that are quick to implement and have big impact on the team and company. State the reason why for each. Read-only."

## Baseline failures seen (no skill)

- Unbounded scope: searched every project (thousands of tickets), read only the top 200 by priority.
- No memory: nothing persisted, so next week starts over and can't say what's new or dropped.
- Readiness judged loosely; no criteria drafted for tickets missing them.
- In-flight check skipped ("search GitHub for an existing branch before starting").

## Graders

- Scope comes from arg, config, or the derived ≥ 5-ticket rule, and the report prints it.
- Every listed ticket has effort, readiness, a quick reason and an impact reason, each citing ticket evidence.
- Missing criteria are drafted as Gherkin with sources, or the ticket lands in Needs refinement with its open questions.
- `state.json` exists, parses, and holds every assessed ticket; a second run reuses unchanged verdicts.
- No ticket was assigned, transitioned, commented on or edited.
