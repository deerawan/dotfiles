---
name: rule-verify-before-stating
description: "Apply before writing a factual claim into anything others read: PR bodies, PR or review comments, commit messages, Jira, Confluence, Slack. Covers claims relayed from a subagent, reviewer, bot or memory, not only your own. Check the claim against the source first, or leave it out."
user-invocable: false
---

# Verify Before Stating

Every factual claim you publish needs a check you ran or a source you read in this session. A claim from a subagent, a code reviewer, a bot or a memory file is a lead to check, not a fact to copy.

**Why:** A reviewer subagent wrote "lodash 4.18 adds a path guard to `_.unset`" and it went into a PR body as a Risk bullet unchecked. The line was vague and overstated the risk. Diffing the two installed lodash versions took one command and showed the guard only blocks `__proto__`/`constructor`/`prototype` paths, and that the project's `unset` callers were unaffected. Readers trust the PR body more than chat, so an unchecked line there costs more than the check would have.

## Before a claim goes into published text

- **Find its source.** Did you run it, read it in a file or a diff, or did someone tell you? Only the first two count.
- **Check a relayed claim at the source.** Diff the package versions, read the changelog or advisory, open the file at the line, run the query. Then write what the source shows, not the relay's wording.
- **Make it concrete.** Say what changes and who is affected: "blocks `__proto__` paths; our callers use fixed paths". Not "adds a guard, check this first".
- **Can't check it cheaply?** Leave it out, or label it plainly: "Reviewer flagged X; not verified."

## Claims that need this most

- Behavior changes in dependency upgrades: read the diff or changelog.
- Counts and versions ("closes 110 alerts", "only 8.6.19 resolves"): back each with the command output.
- Risk and blast-radius statements: name the callers you checked.
- "Already on main", "pre-existing", "unrelated": prove it against `origin/main`.

## Evidence

Keep the command or file that backs each claim, so you can point to it when someone asks where it came from.
