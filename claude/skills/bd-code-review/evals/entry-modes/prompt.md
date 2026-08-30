---
name: Entry modes and fail-fast
tags: [scope]
runs: 1
max_turns: 40
---

Set up a scratch repo from this eval's fixture directory (`fixture/` next to this file):

1. Copy `fixture/base/` into a fresh temp directory, `git init -b master`, commit as "base".
2. `git checkout -b feature-bulk-pricing`, overwrite with `fixture/head/`, commit as
   "add bulk pricing rates support".

Then, in that repo:

3. First run /bd-code-review no-such-ref low — I want to see how it handles a ref that
   doesn't exist.
4. Then run /bd-code-review master low, invoked as if from another skill (programmatic):
   I need the machine-readable verdict block at the end, since a calling agent will gate
   on it.
