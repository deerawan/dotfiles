# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Pause Before Pushing During Review

**Commit locally. Push only when told.**

Once a PR exists and the user is reviewing it:
- Apply review feedback by editing files and committing (or amending) locally.
- Do NOT run `git push` / `--force-with-lease` automatically after each fix.
- Wait for an explicit "push", "looks good, push it", or equivalent before pushing.
- One push per review round, not per file edit.

Pushing each fix forces the user to chase remote state. Their working-tree review of the local diff is faster and lets them batch a single push at the end.

## 6. Writing on My Behalf

**When you write prose as me, sound like me.**

When you're talking or posting on behalf of Budi - Confluence pages, Jira tickets/comments, PR descriptions, design docs, or long-form Slack posts - read and follow `~/.claude/VOICE.md` first. It defines how I write so the output reads like me, not like AI.

This doesn't apply to code, code comments, or your own replies to me in chat.

## 7. Keep CLAUDE.md and AGENTS.md Concise

**When you add or update CLAUDE.md or AGENTS.md, write the tersest statement that's still clear.**

Every line costs context on every session. Cut filler, prefer short imperative rules over prose.

## 8. Code Explains Itself

**Write code that needs no comment. Comments are the exception, not the habit.**

Default is no comment. Make the code say it - rename the variable, extract the function, drop the cleverness.

Allowed:
- **Why**, when non-obvious: a constraint, a business rule, a workaround (link the issue).
- Public API docs, where the project already does it.
- Required annotations (`# type:`, `eslint-disable`, `//go:embed`).

Banned:
- Restating the code (`// increment i`)
- Section headers (`// --- Helpers ---`)
- Narrating your edit (`// Added per request`, `// Changed to fix bug`)
- Commented-out code - delete it, git has it
- TODOs without an owner or ticket

The test: if a competent reader of that code would already know it, delete the comment.

## 9. Unit Tests Stub Every Dependency

**One unit runs for real. Everything it imports is a test double.**

Every import crossing the unit's module boundary gets stubbed - collaborators, repositories, policies, clients, clocks, value-object factories alike. No exemption for "pure" or "simple". Build inputs from literals (`{ id: 'setting-1' }`), not from real factories (`Setting.create(...)`).

Banned: the mock that calls through.

```ts
canDoThing: jest.fn(actual.canDoThing)  // a spy, not a stub
canDoThing: jest.fn()                   // correct - set the return value per test
```

It buys coupling and sells isolation: the test goes red when the collaborator changes, and it silently re-runs logic that already has its own test. Every stubbed export needs an explicit return value in each test that reaches it.

Real collaborators belong in integration tests. Get there deliberately, not by leaving a mock unstubbed.

The test: change the collaborator's logic - if this test goes red, it was never a unit test.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
