---
name: bd-plan
description: Create a grounded, depth-gated implementation plan with dependency-ordered tasks, derived acceptance truths, and a proposed-code sketch under each task.
argument-hint: "[feature description, spec/ticket ref, or existing plan path] [--no-code]"
model: claude-fable-5-1
---

# bd-plan

Decompose work into small, verifiable tasks with explicit acceptance criteria,
grounded in the real codebase, with a directional code sketch under each task so
a human can judge intent at a glance. Every task should be small enough to
implement, test, and verify in a single focused session.

**Planning is read-only.** bd-plan runs without plan mode and without an
approval prompt, so nothing but this rule stops an edit — hold it. No source
edits, no scaffolding, no code execution that mutates state. The only file
written is the plan document, at Step 8.

**Do not reward verbosity.** Plan length is a cost, not a quality signal. The
plan describes only what *changes*; existing behavior is referenced by path,
never re-described.

## When to Use

- You have a spec, ticket, or agreed approach and need implementable tasks
- A task feels too large or vague to start
- Work needs to be parallelized or handed to another agent/session

## Input

Accept a feature description, ticket key, spec path, or an existing plan path
(see Re-runs in Step 8) — plus any upstream artifacts: a ticket carrying
acceptance criteria, technical documentation (design doc, ADR), a design file
(Figma, mockup, image). Artifacts are sources of truth: the plan traces to
them and links them — it never re-describes them.

If **no** spec/ticket/agreed approach exists, run a
brief bootstrap — problem frame, success criteria, explicit non-goals — and
note that genuinely exploratory work deserves an ideation pass before planning.
Do not refuse; do not silently invent product behavior either: in bootstrap
mode, every **product-behavior decision** the bootstrap had to invent (who it's
for, which channel, what threshold) goes through the Step 1 blocking question
round — only codebase facts may ride the non-blocking assumptions block.

`--no-code` suppresses the Proposed code blocks for a terse plan. Unrecognized
`--` tokens: note and ignore — never let them leak into the plan filename. An
explicit depth request from the user ("plan this as Deep") overrides the
Step 0 gate.

---

## Step 0: Gate Depth

**First, invoke the `bd-decision-log` skill** and open this run with a
`plan:start` row. No approval gate means the operator reviews your calls after
the fact, so every call this skill tells you to make on your own — each one
marked *(log it)* below — gets a row the moment you make it.

Never call `EnterPlanMode` — its only exit is an approval prompt, and bd-plan
has none. If plan mode is already active, note it: Step 8b's save is then
blocked, so leave the plan in the conversation and say so. Nothing is written
to disk until Step 8 except the decision log; everything else lives in the
conversation.

Classify the work, from signals — do not ask unless genuinely ambiguous:

| Depth | Signals | Shape |
|---|---|---|
| **Lightweight** | one subsystem, existing pattern to copy, low risk | typically 1–3 tasks, 3 truths inline, sketch every task |
| **Standard** | one feature, some technical decisions, spec/ticket exists | typically 3–6 tasks, truths + artifacts, sketch the non-obvious tasks |
| **Deep** | cross-cutting, migrations, auth/payments/external APIs, high ambiguity | typically 4–8 tasks, full acceptance surface, sketch only the 2–3 non-obvious tasks |

Announce the classification in one line and proceed *(log it)*.

**Risk sets rigor; the work sets task count.** A one-task payment fix gets Deep
rigor (full acceptance surface, checkpoints) with one task — never pad tasks to
match the shape column.

**Reclassify in either direction** once grounding (Step 1) informs you:
upward if it reveals an external contract surface (env vars read by other
systems, exported public APIs, CI config, shared types imported downstream);
downward if the keyword-triggered risk turns out to be routine — an exact
pattern to copy from last week. Say so in one line.

**Exploration subagents launch on your call, not the user's** — no offer, no
wait. Every run explores through subagents; how many is decided case by case
in Step 1.0, not by depth.

## Step 1: Ground

Before writing anything, operate read-only in the repo:

0. **Decide how to explore, case by case**, and announce it in one line *(log it)*:
   - **Simple** — one module, a small utility, a narrow change: spawn **one**
     `Explore` subagent covering the whole change.
   - **Complex** — the code to understand spans several files, packages, or
     services, or the change is cross-cutting: split the work into 2–4
     distinct angles (e.g. the data path, the UI surface, the shared package
     and its importers) and spawn one `Explore` subagent per angle in a
     single message.
   - **External research** — whenever the work leans on an external API, a
     third-party library, or a framework feature the repo hasn't used before,
     add one `general-purpose` subagent with web access to the same message,
     on either path. Brief it with the version the repo pins (from the
     manifest or lockfile) and have it return the documented way to do this
     at that version, known pitfalls, and anything deprecated — each claim
     with a source link. Step 1b weighs its findings; a finding that rules
     out an approach is logged. Skip it when the work only touches the
     repo's own code.

   When in doubt, take the simple path. Every explorer is read-only and returns file
   paths with line numbers, the nearest analogous implementation, conventions,
   importers of touched files, and test commands — pointers, never file dumps.
   Spot-read every cited line the plan will lean on before trusting it. Items
   1–5 below then run against their findings instead of from scratch.
1. **Read every provided artifact** — each owns a different slice:
   - **Ticket**: acceptance criteria and scope boundaries. Each AC must
     resurface in the acceptance surface (Step 2) and the coverage matrix
     (Step 7).
   - **Technical documentation**: decisions already made — the plan follows
     them and references them by link; it re-litigates nothing. Where the doc
     contradicts the code as found, that goes to the question round.
   - **Design file**: the states it shows (empty/error/loading/edge) and the
     components it implies — check each implied component against the nearest
     analogous implementation below.

   When artifacts disagree with *each other*, batch the conflict into the
   question round with a recommendation — never silently pick a winner.
2. **Read the guidance chain**: root `AGENTS.md`/`CLAUDE.md`, then the same in
   every directory the work will touch, plus any coding-guideline docs they
   reference.
3. **Extract Global Constraints verbatim** — version floors, naming rules,
   forbidden imports, exact-dependency policies — into the plan header. Every
   task implicitly inherits them.
4. **Find the nearest analogous implementation** and record its path. Tasks
   name it as the pattern to follow instead of describing conventions from
   memory.
5. **Check reverse dependencies** for any file the work touches in a shared
   package: grep its importers/consumers. This is what makes the Step 0
   reclassify rule's contract surfaces discoverable.
6. **Explore the codebase instead of asking.** Escalate to the user only where
   judgment is genuinely required — including every product-behavior decision
   a bootstrap invented and every artifact conflict — in **one batched
   question round**, each question carrying your recommended answer and its
   main tradeoff.
7. For any **codebase fact** grounding could not resolve, emit:

```text
ASSUMPTIONS I'M MAKING:
1. [assumption]
2. [assumption]
→ Correct me now or I'll proceed with these.
```

Then proceed *(log each assumption)* — codebase assumptions are non-blocking. Product-behavior
decisions never go here; they go through the question round above.

## Step 1b: Compare Designs

Runs at **Deep** always, and at **Standard** when grounding shows more than one
viable shape (where logic lives, data model, module boundary, sync vs async).
Skip at Lightweight — the analogous implementation is the design. Run it before
the item 6 question round so any product fork it surfaces joins that round.

1. Sketch **at least two structurally distinct candidates** — whole shapes, not
   point tweaks inside one shape. Each gets the caller's usage first, then the
   types and signatures it implies.
2. Screen each: does a change that looks right from one file stay right for the
   whole repo? Which hides more behind a smaller public surface? Which matches
   the nearest analogous implementation and Global Constraints? Which has the
   smaller blast radius?
3. **Pick one yourself.** A technical fork is yours to settle, so never ask the
   user to choose. Only a fork that turns on product behavior goes to the
   question round.
4. Record it in Architecture Decisions: a table (Option | Shape | Wins | Loses),
   then the pick and the one reason it won *(log it)*. Task sketches follow the
   pick.

## Step 2: Acceptance Surface

Write this **before** any task exists. Tasks will trace to it.

1. **Observable truths (T1…Tn)** — "What must be TRUE for the goal to hold?"
   Two registers; pick per truth:
   - **User-observable**: verifiable by a human using the application.
   - **System-observable** (refactors, infra, backend-only work): verifiable
     by running the system — tests green before/after, an infra plan/preview
     clean, a log line or metric visible, an endpoint responding.

   Truths that restate tasks are ceremony — rewrite them as *outcomes*.
   Behavior-preserving work is exempt from the user's-perspective framing; its
   honest truths are system-observable.

   **Artifacts anchor the truths.** A ticket's acceptance criteria *are*
   truths — restate each AC as one (or split it into several); never invent a
   parallel set that ignores them. A design file's drawn states are truths:
   "the empty state matches the design's no-orders frame."

```text
Goal: working CSV export
T1. User can trigger an export from the list view
T2. The downloaded file opens with the visible columns, filtered rows only
T3. A failed export shows an error state, not a silent no-op
```

2. **Required artifacts** *(Standard and Deep)* — for each truth, what must
   EXIST: specific files, endpoints, tables.
3. **Required wiring** *(Deep)* — for each artifact, what must be CONNECTED
   for it to function.
4. **Key links** — "Where does this most likely break?" Name the failure mode:
   *"button → mutation (if broken: export appears to start but nothing
   downloads)"*.

Reframe vague goals as measurable criteria before deriving truths:
"make it faster" → "list renders < 500ms at 1k rows".

## Step 3: Behaviour Scenarios

One set of scenarios for the **whole story**, in the user's language, written
before tasks exist. Tasks below this will be backend slices, stubs, and
contracts whose acceptance criteria are technical — that is correct and expected.
The scenarios are how the story is judged; task criteria are how each slice is.

**First, the gate: does this story have a user POV?** Can someone outside the
team tell it shipped, by using the product?

- **Yes → scenarios are required.** Anything a person interacts with, sees, is
  notified by, or downloads.
- **No → write one line and move on:**
  `Behaviour scenarios: none — <reason>; the goal is system-observable (T#).`
  Dependency upgrades, refactors, infra, internal tooling with no product-visible
  change. Never invent a user to satisfy the section.
- **Mixed** — a technical story with one user-visible sliver — gets scenarios for
  the sliver only.

**Given / When / Then, and nothing else:**

- **Given** — the state of the world in user terms: a role, data that already
  exists, the screen they are on. Never a mock, a stub, or a function call.
- **When** — one action the user takes.
- **Then** — what they can observe: a screen, a downloaded file, an email. Not a
  database row, not a return value.

```text
S1 (T2) — Export respects the active filter
  Given I am on the orders list filtered to "Unpaid"
  When I export the list to CSV
  Then the file contains only unpaid orders, with the columns I can see
  Demonstrable after: Task 4
```

1. **Scenarios span tasks.** One scenario usually needs the schema task, the API
   task, and the UI task together, so `Demonstrable after` stays `—` until Step 6
   fills it from the finished phases. That line is the plan's demo schedule and
   its Step 7 coverage check.
2. **Cover the story's journeys**, not each truth three times: the main path, the
   edge a real user will hit, and any failure the user must be told about.
3. **The ticket's own scenarios win.** If the story already states Gherkin or
   user-facing ACs, restate those — normalized, never a parallel invented set.
4. **User words, not system words.** "Then the request returns 422" is a system
   check; the user's version is "Then I see which fields are invalid". Where the
   API *is* the product (public endpoint, webhook), its consumer is the user.
5. **No implementation nouns** — no table, component, function, or hook names, no
   HTTP verbs, no selectors or fixtures.
6. **Truths are the checklist; scenarios are the walkthrough.** If a scenario
   says nothing its truth didn't, cut it — that truth has one obvious path.
7. **Depth-scaled:** Lightweight keeps them inline under the truths, main path
   only unless a failure is user-facing. Standard and Deep get the plan section.

## Step 4: Dependency Graph and Slicing

Map what depends on what, bottom-up. Then slice **vertically**:

```text
Bad  (horizontal): Task 1 all schema → Task 2 all APIs → Task 3 all UI
Good (vertical):   Task 1 user can register (schema+API+UI)
                   Task 2 user can log in   (schema+API+UI)
```

Horizontal layers are justified only for a shared foundation (auth before
protected features, a contract both sides consume) — in that case the contract
is its own early task.

**Record each task's `Files:` list** (provisional here; Step 5 formalizes it).
Tasks with disjoint file sets can run in parallel (waves); a file appearing in
two tasks makes the later task depend on the earlier. This is mechanical as a
starting point — disjoint files are necessary, not sufficient: migrations and
shared-state changes stay sequential regardless.

**Delta-planning:** describe only the change. Reference existing behavior by
`path/to/file.ts` and stop. If a section of the plan re-explains code that
isn't being modified, delete the section.

## Step 5: Write Tasks

Each task follows this structure:

````markdown
## Task [N]: [Short descriptive title]   <!-- "and" in the title = two tasks -->

**Description:** One paragraph explaining what this task accomplishes.

**Traces to:** T1, T3

**Consumes / Produces:**
- Consumes: `parseFilters(input: FilterInput): WhereClause` (Task 2) — or `none`
- Produces: `exportCsv(rows: Row[], cols: Col[]): Buffer` — Task 5 relies on
  this exact signature

**Acceptance criteria:**
- [ ] [Specific, testable condition]

**Test scenarios:** <!-- categories that apply; never blank -->
- Happy path: [input/action → expected outcome]
- Edge case: [boundary, empty, null]
- Error path: [failure → expected handling]
- Integration: [cross-layer behavior mocks won't prove]
<!-- or: Test expectation: none — [reason] (config/scaffolding only) -->

**Verification:** [observable outcome + command, e.g. `npm test -- --filter=export`]

**Dependencies:** [Task numbers, or None]

**Files:**
- Create: `exact/path/new.ts`
- Modify: `exact/path/existing.ts`
- Test: `exact/path/new.test.ts`

**Design:** [link to the specific frame/screen this task builds, or `none`]

**Proposed code:** *(directional — shows intent for review, not code to paste;
the implementer re-derives against the real codebase)*

```typescript
// exact/path/new.ts — the interesting part only
export function exportCsv(rows: Row[], cols: Col[]): Buffer {
  const header = cols.map((c) => escape(c.label)).join(',')
  // ...row mapping mirrors ListView's visibleColumns ordering...
}
```

**Estimated scope:** [XS | S | M | L — XL means split before proceeding]
````

### Proposed-code rules

The plan must contain no placeholders, and no full implementations. The
resolution:

1. **Sketch the interesting part only** — core logic, the tricky transform,
   the query. Imports, wiring, and test boilerplate elided with `...`.
   ~10–25 lines per task, never full files.
2. **The directional label is mandatory** on every block.
3. **Signatures are the contract; code is illustration.** If a sketch and the
   `Consumes / Produces` block disagree, the signatures win.
4. **Which tasks get a sketch is set by the depth gate — the Step 0 table's
   Shape column is the only criterion.** Every task without one carries
   `Proposed code: none — [reason]`.
5. **Under `--no-code`, omit the field entirely** — the Consumes/Produces
   signatures and prose then carry the full contract.

Everything the code block elides (or `--no-code` suppresses) must still be
*named* in prose or signatures — "similar to Task N" and "add appropriate
error handling" are plan failures, not shortcuts.

If a task introduces a directory Step 1 never grounded (a new migration dir, a
shared package), ground it before writing the task.

## Step 6: Order, Phases, and Checkpoints

Arrange tasks so that:

1. Dependencies are satisfied (foundation first)
2. High-risk tasks come early (fail fast)
3. Each task leaves the system in a working state

**Group tasks into phases — depth-scaled.** Lightweight plans keep a flat task
list. At Standard and Deep, each phase is one dependency wave from Step 4,
named for what it delivers. Phases render the wave analysis: tasks inside a
phase with disjoint `Files:` lists are explicitly parallel. Name phases by
what they deliver, not by layer (no "Backend phase" / "Frontend phase" —
that's horizontal slicing sneaking back in).

Add checkpoints at **risk boundaries** — which may or may not coincide with a
phase end — never every N tasks:

- after the contract task both sides will consume
- after anything touching an external surface (API, CI, shared types, schema)
- before anything hard to reverse (data migration, published ID format, wire
  format)

```markdown
### Phase 1: Contract (Task 1–2)
### Checkpoint: contract locked
- [ ] Schema/typegen builds; both consumers compile against it
- [ ] Review with human before parallel work fans out
### Phase 2: Feature slices (Task 3–5 — parallel, disjoint files)
```

**Split signal:** if executing the whole plan won't plausibly finish inside
~50% of an executor's context (many files, heavy discovery, complex domains),
split into sequential plan files, each independently executable.

**Then reconcile the scenarios** (Step 3) against the decomposition you just
built — this is the pass where a thin user story shows its gaps:

- Fill each scenario's `Demonstrable after` with the task or phase that makes it
  true. A scenario nothing makes demonstrable is a missing task.
- Add any scenario the decomposition revealed — an empty state, a permission
  case, a partial failure the layering exposed — and mark it
  `(revealed during planning)`.
- Raise the revealed ones with the user in one batch. A behaviour that only
  appeared once tasks existed usually means the story is missing a piece, and
  that is a product decision, not yours to settle.

## Step 7: Structural Self-Check

Mechanical checks only — this step never judges plan quality (quality
judgment belongs to a separate review pass). Run in order:

1. **Scope-trace / coverage matrix** *(the most common miss is untraced
   tasks)*: every task ↔ ≥1 truth; every requirement/success criterion — a
   ticket's acceptance criteria included — → ≥1 task. Anything untraceable is
   scope creep — cut it, or add the missing
   truth and list that addition in the plan's Risks section as *retrofitted*,
   so a downstream reviewer can tell derived truths from post-hoc ones.
2. **Scenario coverage**: the story either has scenarios or the one-line
   justification. Every user-visible ticket AC appears in ≥1 scenario; every
   scenario's `Demonstrable after` names a task or phase that exists; no scenario
   names a file, function, or component.
3. **Placeholder scan** — these are plan failures; fix inline:
   "TBD", "TODO", "implement later", "add appropriate error handling",
   "handle edge cases", "write tests for the above", "similar to Task N".
4. **Signature diff**: names and types in `Consumes / Produces` match across
   tasks (a `clearLayers()` in Task 3 that Task 7 calls `clearFullLayers()` is
   a bug).
5. **Sizing**: no task is XL or touches more than ~8 files.

Report findings with severity — **blocker** (fix before saving) vs **warning**
(note in the plan's Risks section) — then fix blockers inline and move on.
Do not emit a verdict on your own plan.

## Step 8: Review, Save, Hand Off

No approval gate. The plan-review pass stands in for it; the operator's next
approval is bd-execute's dispatch gate.

### 8a. Review and autofix — `plan-review`

Before saving, invoke the **plan-review** skill on the finished plan. It runs
its own research subagents, so it stays a separate pass from the author.

- **Fix every `[blocker]` and `[warning]` yourself**, without asking —
  plan-review's "don't rewrite" rule yields to this step. Re-read each
  finding's cited source first; drop one that doesn't hold up and say why.
- A fix that needs a product-behavior call goes to Open Questions with your
  recommendation, never a guess.
- Leave `[nit]`s unfixed and list them in the handoff.
- One review pass. Don't re-review your own fixes.
- *(Log each finding fixed, dropped, or deferred.)*

In the handoff, show a short review summary: verdict, what was fixed, what was
dropped, nits left — then the decision log's one-line summary and path.

### 8b. Save

Save to `~/.claude/plans/<kebab-topic>.md` — user-level (reachable from every
worktree), descriptive kebab-case name, never a random generated name. This is
the durable copy and the one downstream skills read.

Do the re-run / `.vN` snapshot handling below at this point, after 8a's fixes.

**Plan document skeleton:**

```markdown
# Implementation Plan: [Name]

## Overview            <!-- one paragraph -->
## Sources             <!-- ticket, tech doc, design file — linked, never re-described -->
## Global Constraints  <!-- verbatim from Step 1; every task inherits -->
## Assumptions         <!-- from Step 1, if any -->
## Acceptance Surface  <!-- truths T1…Tn, key links -->
## Behaviour Scenarios <!-- S1…Sn, or the one-line "none — technical story" -->
## Architecture Decisions  <!-- decision + rationale, delta only; Step 1b options table when it ran -->
## Tasks               <!-- Step 5 structure, checkpoints interleaved -->
## Risks               <!-- table: Risk | Impact (High/Med/Low) | Mitigation.
                            Rows include self-check warnings and retrofitted
                            truths; a risk with no mitigation is either
                            accepted (say so) or a gap -->
## Open Questions
### Deferred to implementation  <!-- execution-time unknowns, stated honestly -->
## Revision History           <!-- re-runs append: date, vN snapshot, what changed -->
```

Lightweight plans keep a flat Tasks section and drop any skeleton section that
would be empty.

**Re-runs / stale plans:** if the target filename **already exists** — no
matter what form the invocation took — first check it describes the same piece
of work; if it's an unrelated plan that happens to share the name, pick a more
specific filename instead. Same work: copy the existing file to
`<name>.v<N>.md` (N = highest existing N + 1; `csv-export.md` →
`csv-export.v2.md`), then revise the **original path** in place. Preserve
completed checkboxes only for tasks whose body is unchanged — a revised task
gets un-checked — and append what changed to Revision History.

**Handoff — offer, don't perform:**
- execution (this session or a fresh one, plan file as the prompt)

---

## Task Sizing

| Size | Files | Scope | Example |
|------|-------|-------|---------|
| **XS** | 1 | Single function or config change | Add a validation rule |
| **S** | 1–2 | One component or endpoint | New API endpoint |
| **M** | 3–5 | One feature slice | Registration flow |
| **L** | 5–8 | Multi-component feature | Search with filters |
| **XL** | 8+ | **Too large — break it down** | — |

Break a task down further when:
- It wouldn't finish in one focused session
- Acceptance criteria need more than 3 bullets
- It touches two independent subsystems
- The title contains "and"

## Principles

- **Planning-time vs execution-time unknowns stay separate.** Exact helper
  names, final SQL, behavior visible only at runtime — record under
  "Deferred to implementation". Never pretend an execution-time question is
  settled to make the plan look complete.
- **The plan is the prompt.** Write for an executor with zero conversation
  context: exact paths, exact signatures, named patterns.

## Red Flags

Structural failures (placeholders, untraced tasks, missing criteria, oversized
tasks) are Step 7's job to catch — these are the temptations to self-check for:

- Starting implementation during planning (planning is read-only)
- Calling `EnterPlanMode`, or asking the user to approve the plan
- Saving the plan file — or snapshotting a `.vN` — before 8a's fixes land
- Emitting a verdict on your own plan (8a's plan-review is that pass)

## Verification

Before saving, confirm:

- [ ] No `EnterPlanMode`, no approval prompt; nothing but the decision log
      written to disk before 8b
- [ ] `bd-decision-log` loaded at Step 0; every *(log it)* call has a row;
      rows checked against the run before handing back
- [ ] plan-review ran; every blocker and warning fixed or dropped with a reason;
      nits listed in the handoff
- [ ] Depth announced; classification still fits what grounding revealed
- [ ] Exploration call (simple/complex) announced; one explorer (simple) or
      2–4 (complex) spawned unasked; cited lines spot-read
- [ ] External research subagent spawned whenever the work leans on an external
      API, library, or new framework feature, briefed with the pinned version
- [ ] Step 1b ran where required: ≥2 distinct candidates, pick made without
      asking, options table in Architecture Decisions
- [ ] Global Constraints extracted verbatim; assumptions surfaced
- [ ] Truths written before tasks
- [ ] Behaviour scenarios written for any story with a user POV — or their
      absence justified in one line
- [ ] Every task follows the Step 5 structure; sketches follow the depth
      gate (field omitted entirely under `--no-code`)
- [ ] Checkpoints sit at risk boundaries
- [ ] Self-check ran; blockers fixed
- [ ] Saved to `~/.claude/plans/` with a descriptive kebab-case name
