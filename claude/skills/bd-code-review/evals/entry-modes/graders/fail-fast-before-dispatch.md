---
type: llm
criteria: "Did the bad-ref run fail before any reviewer subagent was dispatched, naming the unresolvable ref?"
focus: trace
---

Scoring:
- 2 points: the `no-such-ref` run stopped at scope resolution with a message naming the
  bad ref, and no lane subagent was spawned for that run.
- 1 point: it failed before dispatch but with a vague error that doesn't name the ref.
- 0 points: reviewer subagents were dispatched for the bad-ref run, or the run pretended
  to produce a review.
