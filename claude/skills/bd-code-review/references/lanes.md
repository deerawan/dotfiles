# Lane briefs

One brief per lane. The dispatch step injects the lane's section plus the
reportable-finding definition from `verify-rubric.md` into that reviewer's prompt.
Every `Skip when:` that fires is recorded in the report's Coverage section with its
reason — a skipped lane never fails the run.

## Lane: correctness

Trigger: always, at every effort.
Skip when: never.

A finding in this lane IS a defect the diff introduces: wrong output for a concrete
input, a crash path, a state inconsistency, a race, an off-by-one. Scan the changed
hunks first; then read the git blame/history of the modified code and report anything
the history shows this change breaks (a guard added for a past incident now removed, a
workaround whose reason still holds). Large defects only — describe the failing input
or sequence for each.

## Lane: standards

Trigger: effort medium or high.
Skip when: no CLAUDE.md/AGENTS.md or convention docs found and effort is medium.

A finding in this lane IS a changed line that breaks a rule the repo documents — cite
the file and the rule's wording — or matches one of these smells (always labeled a
judgement call, and a documented repo standard overrides the smell): Mysterious Name,
Duplicated Code, Feature Envy, Data Clumps, Primitive Obsession, Repeated Switches,
Shotgun Surgery, Divergent Change, Speculative Generality, Message Chains, Middle Man,
Refused Bequest. For each smell: name it, quote the hunk, say the fix in one line.

## Lane: spec-fidelity

Trigger: effort high, and a spec source was discovered (ticket, plan file, PR body).
Skip when: no spec source found → Coverage: "spec fidelity — skipped, no spec discovered".

A finding in this lane IS one of: (a) a spec requirement absent or partial in the diff,
(b) behaviour in the diff no spec line asked for — scope creep, (c) a requirement
implemented but wrong. Quote the spec line for every finding.

## Lane: past-pr-comments

Trigger: effort high, and `gh` can list prior PRs touching the changed files.
Skip when: not a GitHub-backed repo, or `gh` unauthenticated.

A finding in this lane IS review feedback from a prior PR on these files that this diff
repeats or violates. Cite the PR number and the original comment.

## Lane: silent-failure

Trigger: the diff adds or modifies catch/rescue/error-handling blocks or fallback logic.
Skip when: no such hunks in the diff.

A finding in this lane IS an error path that loses the failure: an empty or log-only
catch swallowing an action the caller needed, a fallback that masks a defect, an error
message that drops the cause. For each: the concrete failure that gets hidden and who
needed to see it.

## Lane: test-coverage

Trigger: source files changed while test changes are thin or absent.
Skip when: the diff is tests-only, docs-only, or config-only.

A finding in this lane IS a changed public behaviour with no test that would fail if it
regressed: a new exported function without a behavioral test, a bugfix without a
regression test, a test asserting mocks instead of behaviour. Name the missing test
case, not just "needs tests".

## Lane: type-design

Trigger: the diff adds or modifies exported types, interfaces, or schemas.
Skip when: no exported type surface changed.

A finding in this lane IS a type that fails to encode its invariant: a state machine as
booleans, values valid only in combination but constructible apart, a primitive standing
in for a domain concept at a public boundary. Say what invariant the type should make
unrepresentable.

## Lane: security

Trigger: the diff touches auth, user input handling, SQL/queries, dependencies, or
migrations.
Skip when: none of those territories appear in the changed paths.

A finding in this lane IS an exploitable path the diff introduces: unvalidated input
reaching logic or a query, string-built SQL, missing authz on a new surface, a secret
in code or logs, a dependency with a known vulnerability. Describe the attack in one
sentence.

## Lane: design-fidelity

Trigger: UI files (components, styles, templates) touched AND a Figma URL was
discovered in the ticket, PR body, or plan.
Skip when: either half missing, or the Figma MCP tools are unavailable →
Coverage: "design fidelity — skipped, <reason>".

Pull the design context with `get_design_context` and `get_variable_defs` (reference
`get_screenshot`); static comparison only — never a running app, never pixel-level.
A finding in this lane IS: a hardcoded value where the design uses a token/variable, a
state or variant the design defines that the code lacks, a design-system component the
Code Connect mapping names that the code bypasses, or copy that differs from the design.
Every finding states **which side is likely stale** — a Figma file behind the code is a
finding about the design file, not the code, and is always a judgement call.
