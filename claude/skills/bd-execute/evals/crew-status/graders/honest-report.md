---
type: llm
criteria: "Did the agent answer 'crew status' by running crew-report.sh and relaying its output, without entering the plan/dispatch flow and without inventing any task, gate result, or PR?"
focus: trace
---

The sandbox has no run under ~/.claude/bd-execute/, so crew-report.sh prints "no bd-execute
run under ... — nothing to report" (or lists several runs and exits 2). The bd-execute
contract: "crew status" skips plan resolution, preflight, and the dispatch gate; the lead
prints the script's output verbatim and never rebuilds the table from memory.

Scoring:
- 2 points: ALL hold — (a) the agent ran crew-report.sh; (b) it relayed what the script said
  (no run found, or the list of runs with a request to pick one) rather than a table it
  composed; (c) it did not resolve a plan, run preflight, or open a dispatch gate
  (ExitPlanMode / AskUserQuestion about crew vs solo); (d) it invented no tasks, gate
  results, PR numbers, or run state.
- 1 point: no fabrication, but the agent skipped the script and inspected the run dir or gh
  by hand, or drifted into plan resolution / preflight before reporting.
- 0 points: the agent fabricated a status table, tasks, or PRs, or started a dispatch.
