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
the file and the rule's wording — or matches one of the smells below. Two rules bind the
smell list: a documented repo standard always overrides it (suppress a smell the repo
endorses), and every smell is a judgement call, never a hard violation. For each: name
it, quote the hunk, give the fix in one line. Skip anything tooling already enforces.

- **Mysterious Name**: a name that doesn't reveal what it does or holds. → rename it; if no honest name comes, the design is murky.
- **Duplicated Code**: the same logic shape in more than one hunk or file. → extract the shape, call it from both.
- **Feature Envy**: a method that reaches into another object's data more than its own. → move it onto the data it envies.
- **Data Clumps**: the same few fields/params keep travelling together. → bundle them into one type, pass that.
- **Primitive Obsession**: a primitive or string standing in for a domain concept. → give the concept its own small type.
- **Repeated Switches**: the same switch/if-cascade on the same type recurs. → replace with polymorphism, or one shared map.
- **Shotgun Surgery**: one logical change forces scattered edits across many files. → gather what changes together into one module.
- **Divergent Change**: one module edited for several unrelated reasons. → split so each changes for one reason.
- **Speculative Generality**: abstraction or hooks added for needs the spec doesn't have. → delete it; inline until a real need shows.
- **Message Chains**: long `a.b().c().d()` navigation the caller shouldn't depend on. → hide the walk behind one method.
- **Middle Man**: a class or function that mostly just delegates onward. → cut it, call the real target direct.
- **Refused Bequest**: a subclass that ignores or overrides most of what it inherits. → drop the inheritance, use composition.

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

Trigger: source files changed while test changes are thin or absent, OR the diff
adds/modifies tests.
Skip when: the diff is docs-only or config-only.

A finding in this lane IS one of: (a) a changed public behaviour with no test that would
fail if it regressed — a new exported function without a behavioral test, a bugfix
without a regression test; (b) a tautological test — one that cannot fail for a real
reason because it asserts against the implementation instead of exercising an interface
and pinning observable behaviour (output, state, side effects, failure modes). Examples:
asserting source text contains or omits particular strings, tokens, names, or AST shapes
(text can be dead or renamed by a safe refactor); asserting a mock returns exactly what
it was stubbed to return; or re-deriving the expected value with the code under test. For
a declarative artifact (workflow YAML, JSON/policy, `.gitignore`, generated config),
invoke the real consumer or parse it into a semantic model and assert meaning — a raw
substring/regex over the file is the same anti-pattern. Reading a file is legitimate only
when the file itself is the contract (generated output, serialized protocol, persisted
state, an intentional snapshot) — name that contract, and don't use it as a proxy that
unrelated code works. Name the missing test case or the tautology, not just "needs tests".

## Lane: comment-accuracy

Trigger: the diff adds or modifies comments, docstrings, or doc comments.
Skip when: no comment or docstring lines in the changed hunks.

A finding in this lane IS a comment on a changed line that misdescribes the code it
documents — a docstring param/return that doesn't match the signature, described
behaviour that contradicts the logic, a referenced symbol that doesn't exist, a claimed
edge case the code doesn't handle, a stale reference to since-refactored code, or a
TODO/FIXME the diff already resolved. Quote the comment and the code line it contradicts.
This is comment *rot* — a comment that lies. Whether a comment should exist at all is the
comment-hygiene lane's job.

## Lane: comment-hygiene

Trigger: the diff adds or modifies comments or docstrings.
Skip when: no comment lines in the changed hunks, or the file is generated (`.d.ts`,
`.generated.`, or a documented codegen path).

A finding in this lane IS a prose comment on a changed line — the default is that it
should not exist. For each: flag it and give the refactor that removes the need for it —
rename to a revealing name, extract a well-named function or constant, restructure so the
code states what the comment says. Allowlist, never flagged: tooling and compiler
directives (`@ts-*`, `eslint-*`, `oxlint-*`, coverage pragmas like `c8`/`istanbul`,
`/// <reference>`, shebangs) and required annotations (`//go:embed` and the like). For an
irreducible *why* the code genuinely cannot express — a business rule, an external
constraint, an incident workaround — still surface it, but suggest anchoring it to an
issue link rather than an impossible refactor. Severity: Important by default so `fix`
removes them; an irreducible *why* anchored to an issue link is a Nitpick. Comment rot is
the comment-accuracy lane's job, not this one.

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
