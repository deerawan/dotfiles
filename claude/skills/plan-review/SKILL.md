---
name: plan-review
description: Grill an implementation plan from the current conversation across six angles — technical design document alignment, best practices, codebase conventions, design alignment, ticket acceptance-criteria coverage, and verifiability/loop-readiness — then produce an autonomous review report with a verdict and prioritized fixes. Use when the user runs /plan-review, or asks to review, critique, stress-test, poke holes in, or sanity-check a plan, design, or spec before implementation. Triggers on "review this plan", "grill the plan", "is this plan solid", "/plan-review".
---

# Plan Review

Autonomously critique the plan produced in the **current conversation** (plan-mode output, a written plan, or the approach just discussed) across six angles, then deliver one written report. This is a review, not a rewrite — surface gaps and prioritized fixes; do not edit the plan unless the user asks afterward.

**Posture:** review adversarially — assume the plan will fail and try to prove how. But stay calibrated: only raise what would actually cause problems during implementation, and scale depth to the plan's size and risk. A plan nitpicked to death is as useless as one rubber-stamped.

## Workflow

Run these steps in order. Steps 3 and 4 overlap — kick off the parallel research (step 4) while resolving external inputs (step 3).

### 1. Locate and restate the plan

Find the plan in this conversation (plan-mode output, a `~/.claude/plans/*.md` written this session, or the approach agreed on). If no plan exists in the conversation, stop and say so — don't invent one to review.

Restate in 2-4 bullets what the plan intends to build. This is the baseline every angle is judged against. If the plan is too vague to review, say what's missing and stop.

### 2. Pre-scan the plan

Extract signals that drive later steps:
- **Ticket key** — a JIRA key (e.g. `VP-1234`, `TF-567`) mentioned in the plan or conversation.
- **Technical design doc (TDD)** — a link to a design doc, usually a Confluence page attached to or linked from the ticket, or a URL in the conversation.
- **Design link** — a link to the visual/UX design (Figma most often, but could be Zeplin, Sketch, an image, or a mockup URL). It may be in the plan, the ticket, or the TDD.
- **UI work?** — does the plan build/modify user-facing components, screens, or layouts.
- **Plan type** — feature, refactor/migration, bugfix, or infra? This weights the angles (see step 5).
- **Implementation status** — is the work unbuilt, in progress, or already merged? Check the ticket status, `git log`/branch, and whether the described changes already exist in the code. If it's already built, review it as a *post-hoc verification* (did it land correctly, are there follow-ups?) rather than a pre-flight critique.
- **Domain/stack** — languages, frameworks, and the subsystem being touched (drives research targeting).

### 3. Resolve external inputs (tech design, ticket, design)

If several inputs are missing, gather the questions and ask them in **one batch** before starting research — don't interrupt the review angle-by-angle.

- **Tech design doc (Angle 1):** this anchors your understanding of the *whole feature*, so resolve it first. If a TDD link was found (or the ticket links one — check the ticket's description and remote links), fetch and read it in full via the Atlassian MCP (`getConfluencePage`) or `WebFetch`. Let it correct your restatement of the plan from step 1. If the plan clearly belongs to a feature but no TDD was found, ask the user for it before writing the report — don't silently skip. If the change is genuinely small enough to have no TDD, mark the angle `n/a` and say so.
- **Ticket (Angle 5):** if a ticket key exists, fetch it via the Atlassian MCP (`getJiraIssue`) and pull its acceptance criteria / description. If no key is found, note that AC coverage can't be verified and ask whether there's a ticket.
- **Design (Angle 4):** for UI work, find the design link — check the plan, the ticket, and the TDD (designs are often linked there, not in the plan). If found, pull its context: for Figma use the Figma MCP (`get_design_context` / `get_screenshot` / `get_variable_defs`); for anything else fetch the image/page (`WebFetch` or read the attachment). If it's UI work and **no design link** turns up anywhere, ask the user for it before writing the report — don't silently skip. If the plan is not UI work, skip this angle and say so.

### 4. Launch parallel research subagents

Dispatch these concurrently (single message, multiple tool calls) so their file/web dumps stay out of the main context — you keep only their conclusions:

- **Codebase conventions** — an `Explore` agent: "Find the existing conventions relevant to this plan: [restated plan + subsystem]. Report naming, file/folder layout, error handling, testing patterns, and any existing abstraction this plan should reuse instead of reinventing. Read the repo's guidance files too — the root and touched-directory `CLAUDE.md`/`AGENTS.md` and any coding-guidelines docs they reference — and flag where the plan would violate a documented rule. Also check the plan's factual claims about how the code works ('X is called from Y', 'Z already handles this') and report any that the code contradicts. Cite `file:line`."
- **Best practices** — a `general-purpose` agent with web access (or `WebSearch`/`WebFetch`): "Research current best practices for [the specific requirement/pattern]. Return concrete recommendations, common pitfalls, and any approach the plan should reconsider. Prefer authoritative/recent sources; cite them."

Scale the number of research agents to plan size — one each is the default; add more only for genuinely multi-domain plans.

### 5. Evaluate the six angles

Judge the plan against each. See [The Six Angles](#the-six-angles) below. For each: assign a status, list concrete gaps (tie each to a plan step or the missing thing), and note fixes.

**Weight the angles by plan type — don't force all six.** A UI feature leans on design + AC coverage; an internal refactor/migration leans on codebase conventions, and best-practices (web) is often `n/a` when the plan follows an established in-repo pattern; a bugfix leans on verifiability (does a test reproduce the bug?). Mark a low-relevance angle `n/a` and move on rather than manufacturing a thin finding.

### 6. Synthesize the report

Fold everything into one report using the [Report Format](#report-format). Lead with the verdict, order fixes by impact. Do not modify the plan file; if fixes are substantial, you may end by offering to apply them.

## The Six Angles

**1. Technical design alignment** — Read the TDD as the source of truth for the whole feature, then check the plan against it: does the plan implement the design's architecture, data model, boundaries, and phasing? Flag where the plan diverges from the TDD without justification, where it silently drops something the TDD scopes in, and — going the other way — where the TDD itself is stale or contradicts the current code (surface it rather than following it blindly). This angle also grounds every other angle: a plan that looks fine in isolation but doesn't fit the documented feature is the highest-priority finding. Mark `n/a` only for changes small enough to have no TDD.

**2. Best practices** — Does the plan align with current, authoritative best practice for this kind of work (from the research subagent)? Flag outdated approaches, reinvented wheels, and known pitfalls the plan walks into.

**3. Codebase conventions** — Does the plan match how *this* repo already does things (from the Explore agent)? Flag divergence from naming/layout/error/test patterns, any existing utility, component, or abstraction the plan should reuse instead of building new, and any documented rule in the repo's `CLAUDE.md`/`AGENTS.md`/coding-guidelines the plan would break. Cite `file:line`.

**4. Design alignment** — For UI work: does the plan faithfully implement the design (Figma or wherever it lives) — states, spacing, tokens/variables, responsive behavior, edge/empty/error states shown in the mockup? Flag anything in the design the plan omits, and anything the plan adds that isn't in the design. Skip (and say so) if not UI work.

**5. Acceptance-criteria coverage** — Map every acceptance criterion from the ticket to the plan step(s) that satisfy it. Flag any AC with no covering step (a gap) and any plan work not traceable to an AC (possible scope creep). Distinguish a true gap from an AC the plan **knowingly defers** and explicitly acknowledges — report the latter as *deferred (acknowledged)*, not a failure, but confirm the deferral is intentional and that a follow-up exists. If no ticket, state that coverage is unverified.

**6. Verifiability & loop-readiness** — Every step must carry a concrete, observable verification check (a test, command output, or runtime observation — not "looks right"). Success criteria must be strong enough for an agent to loop on independently, and **user-observable** rather than implementation-focused ("invalid login returns 401", not "bcrypt installed"). Flag steps with weak/absent verification, and rewrite each into a goal + check, e.g. "Add validation" → "Write tests for invalid inputs, then make them pass." Call it out specifically when the plan's **riskiest or most uncertain change** (an open question, a semantics change) is guarded only by a manual check — that's where an automated guard matters most.

## Cross-cutting probes

Apply these across all six angles — findings feed into whichever angle they touch.

- **Edge-case stress test** — invent 2-4 concrete edge/failure scenarios the plan must survive (empty input, concurrent writes, partial failure, the unhappy path shown in the design). For each, check whether a plan step handles it. Unhandled scenarios are gaps.
- **Plan-vs-code contradictions** — where the plan asserts how the current system behaves, verify the code agrees (via the Explore agent), and that any API, type, or function the plan names actually exists. Surface every contradiction — a plan built on a wrong premise, or on a hallucinated symbol, is the most expensive kind of gap. But account for implementation status first: if the plan is already built, the code matching a *different* state than the plan's "current" description means it was executed, not that the premise was wrong — don't report that as a contradiction.
- **Wiring check (key links)** — for each artifact the plan creates (component, endpoint, table, handler), confirm a step actually connects it to its consumer/producer — a fetch call, an import, a query, a route registration. A piece that gets built but never wired is a gap, even when every task is individually complete.
- **Simpler-alternative pass** — apply the subtraction test: for each major piece, ask "what breaks if we remove it?" and "is there a materially simpler approach, or a do-nothing baseline?". Flag over-engineering and scope not asked for (YAGNI).
- **Terminology precision** — flag vague or overloaded terms ("account", "sync", "update") and propose the precise canonical term. If the repo has a `CONTEXT.md`/glossary, check the plan's language against it.
- **Placeholder scan** — flag unfinished filler: "TBD", "TODO", "handle appropriately", "similar to X", "etc." — each is a decision the plan is silently deferring.
- **Undocumented hard decisions** — note any choice that is hard to reverse, surprising without context, *and* a real trade-off; recommend capturing it (e.g. an ADR). Grill hardest where reversal cost is high and the supporting evidence is thin — those decisions carry the most risk.

## Report Format

```
# Plan Review: <short plan name>

**Verdict:** <Ready to build | Ready with fixes | Not ready — rework needed>
<one-sentence justification>

## Angle-by-angle
| Angle | Status | Summary |
|-------|--------|---------|
| 1. Technical design       | ✓ / ⚠️ / ❌ / n/a | … |
| 2. Best practices         | ✓ / ⚠️ / ❌ | … |
| 3. Codebase conventions   | ✓ / ⚠️ / ❌ | … |
| 4. Design alignment       | ✓ / ⚠️ / ❌ / n/a | … |
| 5. AC coverage            | ✓ / ⚠️ / ❌ / deferred / unverified | … |
| 6. Verifiability          | ✓ / ⚠️ / ❌ | … |

## Gaps found
<numbered list; each gap is tagged **[blocker]** / **[warning]** / **[nit]** and names the angle, the concrete problem, the affected plan step / missing item (with file:line or source), AND a recommended resolution — never a complaint without a proposed answer>

## Prioritized fixes
1. <highest-impact fix — what to change and why>
2. …
```

Status key: ✓ solid · ⚠️ minor gaps · ❌ significant gaps.
Verdict mapping: any **blocker** → "Not ready"; only **warnings**/**nits** → "Ready with fixes"; none → "Ready to build".

## Rules

- **Resolve before flagging.** If a question can be answered by reading the code or the ticket, answer it yourself — only report what's genuinely open. Don't dump questions you could have resolved.
- **Every gap ships a recommended resolution.** State the problem *and* what to do about it. A complaint without a proposed answer isn't a finding.
- **Evidence over opinion.** Every gap cites a source: `file:line`, an AC, a design element, or a research finding. No hand-waving.
- **No uncited blockers.** A finding without a concrete citation can't be a blocker — cap it at warning. Before finalizing, re-verify every blocker against its source; synthesized subagent findings hallucinate, so re-read the cited line and cut or downgrade anything that doesn't hold up.
- **Confidence gate.** Only surface a finding you're ~80%+ sure is real. When you can't verify it, drop it or downgrade it to an explicit open question — never inflate an unverified suspicion into a blocker.
- **Don't flag false positives.** Skip: anything a linter/typechecker/CI will catch; nitpicks a senior engineer wouldn't raise; pre-existing issues the plan doesn't touch; and intentional, reasonable choices that simply aren't how you'd do it. These drown the real findings.
- **Push back honestly.** If the plan is genuinely solid on an angle, say ✓ — don't manufacture concerns. If it's fundamentally wrong, say so plainly.
- **Don't rewrite the plan.** Report and recommend. Apply fixes only when the user asks afterward.
- **Don't skip an angle silently.** If an angle can't be evaluated (no ticket, no design, not UI), mark it `n/a`/`unverified` and say why.
