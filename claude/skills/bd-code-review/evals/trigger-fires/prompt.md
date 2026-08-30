---
name: Trigger on natural review ask
tags: [trigger]
runs: 2
max_turns: 40
---

Set up a scratch repo from this eval's fixture directory (`fixture/` next to this file):
copy `fixture/base/` into a fresh temp directory, `git init -b master`, commit; then
`git checkout -b feature-bulk-pricing`, overwrite with `fixture/head/`, commit.

Now: review my changes on this branch against master before I open a PR.
