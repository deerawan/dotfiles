---
type: llm
criteria: "Does the comment lead with its ask, split into short one-idea paragraphs, keep code spans light, and drop facts the reader doesn't need, while staying faithful?"
focus: output
---

Baseline (a real inline review comment, 2026-11-23, written with the skill loaded): one six-fact paragraph, code spans in nearly every sentence, the hedge mid-paragraph, and three questions at the very end. The user found it hard to read even after the skill pass.

Accepted rewrite:
> [Important] Should `customer` be a `Customer` relation instead of a `number`?
>
> In #310 this field was generated as a relation (`@OneToOne`). Here it's a plain number. If the generator runs again later, it may switch the field back to a relation and break code that expects a number.
>
> Could we rerun `sync-entities` to confirm what the generator produces? If it really is a number, renaming the field to `customerId` would make that clearer.

After the edits (3 runs, 2026-11-23): 3/3 lead with the ask and drop the full decorator; 2/3 keep one piece of evidence; most still keep the migration number and the generator file name.

Scoring (2 = all pass, 1 = one fails, 0 = two or more fail):
- The title line (or first sentence) states the ask or the problem as the reader's decision, not only a description.
- No paragraph holds more than ~3 sentences or more than one idea (what differs / why it matters / what to do).
- No sentence carries more than two code spans; full decorator signatures and file/migration names appear only where the author must act on them.
- Facts the reader can infer or doesn't need (migration number, sibling entity, MikroORM internals) are dropped or compressed to a clause.
- Faithful: "likely"/"may" certainty kept, the uncertainty survives (folded in or stated), both remedies kept, no invented fact.
