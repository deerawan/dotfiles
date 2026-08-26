# Checkpoint and resume

A bd-execute run survives a context clear better than most work, because the crewmates are
**separate live sessions**: clearing the lead loses supervision, not progress. Crewmates keep
working, keep writing their status files, and keep pushing notifications at the lead name —
which the next lead session inherits by re-claiming that name.

Almost everything the lead knows is already on disk (phase file = the map, `crew.json` =
addresses + `spawned_at`, `task-*.status` = progress). The checkpoint covers the rest — the
judgment that isn't derivable.

## Writing the checkpoint

The triggers live in SKILL.md. The auto-triggers matter most: an auto-compaction never
announces itself, so a checkpoint that only gets written when asked is one that's missing
exactly when it's needed. Write it as supervision events happen and it is always current —
the explicit triggers then cost nothing but a refresh of the timestamp.

Write `<run-dir>/CHECKPOINT.md`, overwriting the previous one:

```markdown
---
phase: <N>
wave: <W> of <total>
updated: <ISO timestamp>
---

## Where we are
<one paragraph: which wave is in flight, what settled, what's next>

## Decisions I made
- task <id> asked <question> → I answered <answer> (from <plan section / file>)

## Deviations in flight
- task <id> changed <what> → relayed to <siblings>, <unspawned tasks still to fix>

## Open with the human
- <question relayed, still unanswered> — crewmate <id> is waiting on it

## Next action
<the single first thing the next lead session should do>
```

Rules: overwrite, never append (it's a snapshot, not a log); record **why**, not just what;
delete it on resume once its contents are absorbed — durable facts belong in the phase file,
not here. Never put branch maps, PR urls, or task states in it — those are derivable, and a
stale copy competing with the real files is worse than no copy.

## Resume

Read `CHECKPOINT.md` first if it exists (then delete it after absorbing). Beyond it,
`EXECUTION.md` + the phase file + status files + `crew.json` + `stax status` are the truth;
trust them over memory. Read `EXECUTION.md` first (index), then only the target phase's
`phases/phase-<N>.md` — it holds the approved branch map. **Never re-derive branch names or
parents when a phase file exists**; re-derivation can produce different slugs and orphan the
existing branches. Then: `done` with commits on the branch = complete
(never re-spawn). `running` with a live herdr agent = leave it alone; rejoin supervision.
`running` with agent `gone` = re-offer at the dispatch gate as a re-spawn (same branch if it
has commits — the lane persists). Un-spawned tasks resume with their frozen branch names.
**Re-claim the lead identity** (`herdr agent rename <own-pane> <run-slug>-lead`, tab `lead`)
so crewmate notifications land in the new session; check each crewmate's tab with
`herdr agent read <agent-name>` for anything it reported while no lead was listening.
**Re-entering Step 7 will not touch a PR that already has a body.** Step 7.2 posts
`task-<id>.pr.md` only into an empty body, so PRs opened on an earlier pass keep what they
have now — including screenshots and edits a human added while you were gone. `pr.md` is a
one-shot handoff, not a copy to re-apply; past first post the PR is the source of truth.
Re-running a fully executed phase → nothing to do; point at the next phase. A phase with no
row in the `EXECUTION.md` index was never approved — it goes through Steps 2–3 normally.
