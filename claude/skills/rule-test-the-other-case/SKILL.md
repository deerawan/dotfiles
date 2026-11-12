---
name: rule-test-the-other-case
description: "Apply before rebutting a review comment, dismissing a bot finding, or declaring a check or cleanup done. Run the case your evidence never exercised (the clean run, the empty input, the hidden or OFF path) instead of arguing from what the code was meant to do."
user-invocable: false
---

# Test the Other Case

When a claim about behavior can be tested, run the case that would prove it, and run it before you answer. Evidence from one case says nothing about another.

**Why:** Agents verify the case in front of them. A scan run on a branch full of hits always exits 0, so the clean-scan failure never shows. A cleanup checked on the screen the user sees never reaches styling that only CSS hides. Each passing run feels like proof, but it covers one branch. Rebutting a reviewer from intent ("the agent reads the output anyway") costs one wrong reply. Running the case costs ten seconds.

## Before you reply to a review claim

- If the comment states a behavior ("exits 123 when clean", "still renders the stripe"), reproduce that exact case first. Treat the claim as a test to run, not an opinion to weigh.
- Disagree only with output in hand. "I ran X with no matches and it exited 0" is a rebuttal. "It's only meant for interactive use" isn't.
- Bot findings get the same check. Low confidence in the source is no reason to skip a cheap test.

## Before you call a check or cleanup done

List the cases the change has, then confirm each one ran at least once:

- **Success and empty:** hits and no hits, rows and zero rows, a list and an empty list.
- **Live and dead paths:** flag ON and OFF, and code that CSS, a default or a fallback makes unreachable but doesn't remove.
- **Normal and error:** a valid input and a missing file, a bad argument, a failed upstream call.

When your test fixture can only produce one case, build a fixture for the other (a file with no hits, a row without the field). A fixture that can't reach the branch can't prove it.

## Evidence

Record which case each run covered. "Exit 0 on a file with no hits, exit 1 on a missing file" is evidence. "Ran it, works" is not.
