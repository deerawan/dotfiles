---
name: bd-plan
description: Create a grounded, depth-gated implementation plan with dependency-ordered tasks, derived acceptance truths, and a proposed-code sketch under each task.
argument-hint: "[feature description, spec/ticket ref, or existing plan path] [--no-code]"
disable-model-invocation: true
---

# bd-plan

Decompose work into small, verifiable tasks with explicit acceptance criteria,
grounded in the real codebase, with a directional code sketch under each task so
a human can judge intent at a glance. Every task should be small enough to
implement, test, and verify in a single focused session.

**Planning is read-only, and enforced — not promised.** bd-plan runs inside plan
mode, so the harness blocks edits rather than trusting this paragraph. No source
edits, no scaffolding, no code execution that mutates state. The output is a
plan document.

**Do not reward verbosity.** Plan length is a cost, not a quality signal. The
plan describes only what *changes*; existing behavior is referenced by path,
never re-described.

## When to Use

- You have a spec, ticket, or agreed approach and need implementable tasks
- A task feels too large or vague to start
- Work needs to be parallelized or handed to another agent/session

## Input

Accept a feature description, ticket key, spec path, or an existing plan path
(see Re-runs in Step 7) — plus any upstream artifacts: a ticket carrying
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

## Step 0: Enter Plan Mode, then Gate Depth

**Call `EnterPlanMode` first — before reading a single file.** Grounding is
itself read-only work, so there is nothing bd-plan does that belongs outside
plan mode. Entering it is what makes the read-only contract real: the harness
refuses edits, so a plan run cannot quietly become an implementation run.

- The user must consent to entering. If they decline, say in one line that
  planning will proceed under the read-only contract without harness
  enforcement, and continue — a declined prompt is not a reason to refuse the
  work.
- **If plan mode is already active, do not call it again.** Note it and move on.
- Nothing is written to disk until Step 7, after the approval gate. Everything
  between here and there lives in the conversation.

Then classify the work, from signals — do not ask unless genuinely ambiguous:

| Depth | Signals | Shape |
|---|---|---|
| **Lightweight** | one subsystem, existing pattern to copy, low risk | typically 1–3 tasks, 3 truths inline, sketch every task |
| **Standard** | one feature, some technical decisions, spec/ticket exists | typically 3–6 tasks, truths + artifacts, sketch the non-obvious tasks |
| **Deep** | cross-cutting, migrations, auth/payments/external APIs, high ambiguity | typically 4–8 tasks, full acceptance surface, sketch only the 2–3 non-obvious tasks |

Announce the classification in one line and proceed.

**Risk sets rigor; the work sets task count.** A one-task payment fix gets Deep
rigor (full acceptance surface, checkpoints) with one task — never pad tasks to
match the shape column.

**Reclassify in either direction** once grounding (Step 1) informs you:
upward if it reveals an external contract surface (env vars read by other
systems, exported public APIs, CI config, shared types imported downstream);
downward if the keyword-triggered risk turns out to be routine — an exact
pattern to copy from last week. Say so in one line.

At **Deep** only, you may *offer* research subagents (pattern exploration, best
practices). Never launch them unasked at any depth.

## Step 1: Ground

Before writing anything, operate read-only in the repo:

1. **Read every provided artifact** — each owns a different slice:
   - **Ticket**: acceptance criteria and scope boundaries. Each AC must
     resurface in the acceptance surface (Step 2) and the coverage matrix
     (Step 6).
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

Then proceed — codebase assumptions are non-blocking. Product-behavior
decisions never go here; they go through the question round above.

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

## Step 3: Dependency Graph and Slicing

Map what depends on what, bottom-up. Then slice **vertically**:

```text
Bad  (horizontal): Task 1 all schema → Task 2 all APIs → Task 3 all UI
Good (vertical):   Task 1 user can register (schema+API+UI)
                   Task 2 user can log in   (schema+API+UI)
```

Horizontal layers are justified only for a shared foundation (auth before
protected features, a contract both sides consume) — in that case the contract
is its own early task.

**Record each task's `Files:` list** (provisional here; Step 4 formalizes it).
Tasks with disjoint file sets can run in parallel (waves); a file appearing in
two tasks makes the later task depend on the earlier. This is mechanical as a
starting point — disjoint files are necessary, not sufficient: migrations and
shared-state changes stay sequential regardless.

**Delta-planning:** describe only the change. Reference existing behavior by
`path/to/file.ts` and stop. If a section of the plan re-explains code that
isn't being modified, delete the section.

## Step 4: Write Tasks

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

## Step 5: Order, Phases, and Checkpoints

Arrange tasks so that:

1. Dependencies are satisfied (foundation first)
2. High-risk tasks come early (fail fast)
3. Each task leaves the system in a working state

**Group tasks into phases — depth-scaled.** Lightweight plans keep a flat task
list. At Standard and Deep, each phase is one dependency wave from Step 3,
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

## Step 6: Structural Self-Check

Mechanical checks only — this step never judges plan quality (quality
judgment belongs to a separate review pass). Run in order:

1. **Scope-trace / coverage matrix** *(the most common miss is untraced
   tasks)*: every task ↔ ≥1 truth; every requirement/success criterion — a
   ticket's acceptance criteria included — → ≥1 task. Anything untraceable is
   scope creep — cut it, or add the missing
   truth and list that addition in the plan's Risks section as *retrofitted*,
   so a downstream reviewer can tell derived truths from post-hoc ones.
2. **Placeholder scan** — these are plan failures; fix inline:
   "TBD", "TODO", "implement later", "add appropriate error handling",
   "handle edge cases", "write tests for the above", "similar to Task N".
3. **Signature diff**: names and types in `Consumes / Produces` match across
   tasks (a `clearLayers()` in Task 3 that Task 7 calls `clearFullLayers()` is
   a bug).
4. **Sizing**: no task is XL or touches more than ~8 files.

Report findings with severity — **blocker** (fix before saving) vs **warning**
(note in the plan's Risks section) — then fix blockers inline and move on.
Do not emit a verdict on your own plan.

## Step 7: Approve, Save, Hand Off

### 7a. Approval gate — `ExitPlanMode`

Present the finished plan and call `ExitPlanMode`. **This is the gate: nothing
is written to disk before the user approves.** Do not ask "is this plan okay?"
via `AskUserQuestion` — `ExitPlanMode` *is* that question, and asking twice
reads as a stall.

The whole plan goes into plan mode's own plan file so the user reviews the real
thing, not a summary of it. Where the harness names that file, write there.

Two outcomes:

- **Approved** → continue to 7b and save to `~/.claude/plans/`.
- **Rejected, or the user asks for changes** → stay in plan mode, revise, and
  gate again. Never save a rejected plan; never treat "one more thing" as
  approval.

If plan mode was never entered (the user declined in Step 0), there is nothing
to exit — show the plan, get an explicit go-ahead, then save.

### 7b. Save

Save to `~/.claude/plans/<kebab-topic>.md` — user-level (reachable from every
worktree), descriptive kebab-case name, never a random generated name. This is
the durable copy and the one downstream skills read; plan mode's own plan file
is a review surface, not the artifact.

Do the re-run / `.vN` snapshot handling below at this point — after approval,
never before. Snapshotting a plan the user then rejects leaves a `.v2` file
recording a version that was never adopted.

**Plan document skeleton:**

```markdown
# Implementation Plan: [Name]

## Overview            <!-- one paragraph -->
## Sources             <!-- ticket, tech doc, design file — linked, never re-described -->
## Global Constraints  <!-- verbatim from Step 1; every task inherits -->
## Assumptions         <!-- from Step 1, if any -->
## Acceptance Surface  <!-- truths T1…Tn, key links -->
## Architecture Decisions  <!-- decision + rationale, delta only -->
## Tasks               <!-- Step 4 structure, checkpoints interleaved -->
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
- a separate review pass to critique it (bd-plan never reviews its own output)
- user annotation or edits to the plan file
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
tasks) are Step 6's job to catch — these are the temptations to self-check for:

- Starting implementation during planning (planning is read-only)
- Skipping `EnterPlanMode` and relying on the read-only paragraph instead
- Saving the plan file — or snapshotting a `.vN` — before `ExitPlanMode`
  approval
- Treating a request for changes as approval
- Emitting a verdict on your own plan (review is a separate pass)

## Verification

Before saving, confirm:

- [ ] `EnterPlanMode` called before any file was read — or the user declined and
      that was stated
- [ ] Plan presented and approved via `ExitPlanMode`; nothing written to disk
      before that
- [ ] Depth announced; classification still fits what grounding revealed
- [ ] Global Constraints extracted verbatim; assumptions surfaced
- [ ] Truths written before tasks
- [ ] Every task follows the Step 4 structure; sketches follow the depth
      gate (field omitted entirely under `--no-code`)
- [ ] Checkpoints sit at risk boundaries
- [ ] Self-check ran; blockers fixed
- [ ] Saved to `~/.claude/plans/` with a descriptive kebab-case name
