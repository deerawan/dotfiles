# Ship the picked proposals

## 1. Worktree from origin/main

Each Bash call starts a new shell, so start every later call with these lines.

```bash
REPO=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
TICKET=<the digest's ticket, or the one the user gave in Step 6>
BRANCH="retro/$(echo "$TICKET" | tr 'A-Z' 'a-z')-<kebab-slug>"
WT="$(dirname "$REPO")/monarch-worktrees/$BRANCH"
```

```bash
git -C "$REPO" fetch -q origin main
git -C "$REPO" worktree add -b "$BRANCH" "$WT" origin/main
```

Make every edit inside `$WT`. Never touch the session's own branch.

## 2. Apply and verify each change

| Target             | Verify with                                                                             |
| ------------------ | --------------------------------------------------------------------------------------- |
| Hook               | Pipe a sample tool-call JSON into it twice: one input it must block, one it must allow. |
| Script             | Run it once on a real input.                                                            |
| Lint rule          | `npx eslint --stdin --stdin-filename <path>` with one violating and one clean snippet.  |
| Test or CI config  | Run the affected test command.                                                          |
| Skill or AGENTS.md | Re-read the edited section in context.                                                  |

## 3. Open the PR

From `$WT`, run the `/pr` skill with the ticket. In the PR body, quote the session moment
behind each change, list the proposals the user didn't pick, and include the step 2
output as the demo. Check each quote for secrets the digest may have missed, and copy no
customer, financial, or personal data. Leave the worktree in place for review fixes.
