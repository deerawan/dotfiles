# Gates and scoring

## Gates

A candidate becomes a proposal only if it passes all of these. A failed gate drops it
with the reason code shown.

| Gate              | Passes when                                                                                                                                                                                      | Reason code if not                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| Durable           | Still true in 6 months, after paths, SHAs, and versions change. Without the change, a future agent on another task would plausibly hit it again.                                                 | `one-off`, `not-durable`                                                                    |
| Evidenced         | It cites at least one digest event, such as `[E12] L1905`.                                                                                                                                       | `one-off`                                                                                   |
| From this session | The session caused it, or it hurt this session's work (an error, a correction, a wasted step). Problems that were only visible, without affecting the session, go under "Noticed, out of scope". | `pre-existing`                                                                              |
| Decision-changing | A future agent acts differently, and doesn't just read more text.                                                                                                                                | `not-decision-changing`                                                                     |
| Specific          | It applies on other tasks, and it's precise enough that an agent knows when. "Run a package's jest from its own folder" passes. "Be careful with tests" doesn't.                                 | `too-generic`, `too-specific`                                                               |
| Not covered       | The Step 3 grep finds no existing rule, check, or earlier rejection.                                                                                                                             | `duplicate`, `already-enforced`, `rejected-before`, `merged` (folded into another proposal) |
| Team scope        | It helps the team, not only one person's own setup.                                                                                                                                              | `personal`                                                                                  |
| Real              | It's this repo's problem, and real friction.                                                                                                                                                     | `upstream` (a third-party tool), `false-positive` (the digest misfired), `nitpick`          |

## Score

Each axis scores 0, 1, or 2. Each score needs a one-line reason that cites an `[E#]` event
or a `file:line`.

| Axis                | 0                                | 1                                        | 2                                                                                                                                                                                                                                            |
| ------------------- | -------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recurrence          | One event, specific to this task | Plausible elsewhere in this area         | ≥2 occurrences in this session (each review comment in a bundled event counts), or a match in the run log                                                                                                                                    |
| Cost when it recurs | The agent fixed it in one step   | A few turns lost, or one user correction | It reached a reviewer, CI, or a user interruption, the user corrected it more than once, a guard failed open, or it took a heavy share of the `spend` line, or of the session's tool output when `spend` is empty (the `heavy_result` sizes) |
| Enforceability      | An AGENTS.md line                | A skill step or skill description        | A hook, script, lint rule, test, or CI check                                                                                                                                                                                                 |
| Verifiable fix      | Speculative                      | Plausible but not shown                  | Can be shown firing (hook sample, script run, lint snippet)                                                                                                                                                                                  |

Subtract 1 when the proposal weakens a guard.

| Total | Verdict shown | Log value |
| ----- | ------------- | --------- |
| ≥6    | include       | `include` |
| 4–5   | your call     | `call`    |
| ≤3    | skip          | `skip`    |
