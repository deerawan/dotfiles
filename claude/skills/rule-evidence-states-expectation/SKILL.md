---
name: rule-evidence-states-expectation
description: "Apply whenever you put evidence in a PR body, PR comment or review-round summary: a screenshot, recording, terminal output or results table. Put a short Gherkin scenario directly above each item that says what it should show, so a reader can check the item against it."
user-invocable: false
---

# Evidence States Its Expectation

Every evidence item gets a Gherkin scenario directly above it that names the expected result. The item that follows is the proof.

**Why:** A Demo section that read "Before", "After, local", "After, CI path" over raw `du` and build output left the reviewer to guess what each block should show. Was a 1.0G cache on run 2 good or bad? Was "No such file" the goal or a failure? The author knew. The reader didn't. One `Then` line per block settles it.

## The shape

````markdown
```gherkin
Given CI is unset
When I build both apps with --force
Then the build succeeds
And no .next/cache/webpack directory is left on disk
```

<the terminal block, screenshot or recording>
````

- **One scenario per item.** A before/after pair shares one scenario, and its `Then` names the difference.
- **Subtitle each item when there are two or more.** Put a `###` heading above each scenario that names what it checks in 1–3 words (`### Code references`, `### Storybook`). Skip it for a single item.
- **Given:** the setup that makes this run differ from the others (env var, flag, data, page).
- **When:** the one command or action that produced the item.
- **Then:** what the item shows, concrete enough to check: an exit status, a value, a file present or absent, text on screen, one run faster than another. Never "it works".
- **Commands, paths and numbers are fine** in steps when the evidence is a terminal. Use screen labels for UI.
- **Every `Then` must match the item.** If the output doesn't show it, fix the change or the scenario before posting.

## Reuse before writing

If the PR body or plan already has scenarios (from `bd-bdd` or a `bd-plan` "Behaviour scenarios" section), label the item with the matching scenario's name, `Scenario: <name>`, and don't write a second scenario. Write a new one only when no existing scenario covers what the item shows.
