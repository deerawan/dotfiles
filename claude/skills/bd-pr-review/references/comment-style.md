# Comment style — posted PR comments

Applies only to the inline comments bd-pr-review posts to a teammate's PR. The
terminal report is unaffected — keep it terse.

## Anatomy

````markdown
<badge> **<Severity>** · <one-line subject: what goes wrong>

<what the reader or user loses, 1–2 sentences, quoting the value they see today.>

**Fix:** <the concrete change, naming the symbol it touches.>

```suggestion
<replacement lines, only when the fix fits the commented lines>
```
````

| Severity | Badge |
|---|---|
| Critical | 🔴 |
| Important | 🟡 |
| Nitpick | 💡 |

Severity is the finding's existing **Critical / Important / Nitpick**. One comment,
one ask. Use **Question:** instead of **Fix:** when the ask is about intent. Add no
greeting, praise, or closing note.

- Say what the reader or user loses, not only what the code does. Quote the message
  or value they see today.
- Write for the author's coding agent as well as the author: the `**Fix:**` line
  must stand alone, so name the function or field instead of "this" or "it". Use a
  `suggestion` block only when the replacement lines are the commented lines, so
  one click or one agent step applies it.

Wrong → Right:

| Wrong | Right |
|---|---|
| "`read_misfit_reason` returns the reason, but this code only checks it for None." | "🟡 **Important** · Upload error hides the misfit reason. A user who uploads a file with an empty `age` column sees `Upload failed`, but `read_misfit_reason` already returns `column 'age' is empty`. **Fix:** put the reason from `read_misfit_reason` in the error message." |

## Tone

- Talk about the code, not the person: "this code requests the service twice", never
  "you request…".
- Ask, don't demand, on naming and judgment calls: "Should we use `userId` here?" not
  "Rename this to userId."
- Pronouns: "we" for proposed changes ("should we…"); "I" only for your own opinion or
  uncertainty; "you" only in a direct question about the author's intent ("did you mean
  to drop the retry?"), never as the one who did something.
- No hyperbole (always, never, nothing, endlessly) and no sarcasm.
- No words about the author's traits (sloppy, careless). Assume they're capable and
  acting in good faith.
- Be humble and explicit: name the tradeoff, admit uncertainty ("I might be missing
  context, but…").
- One ask per comment. If it needs a real back-and-forth, say so and move it to chat.

Wrong → Right:

| Wrong | Right |
|---|---|
| "You're requesting the service multiple times, which is inefficient." | "This code requests the service on every render, which is more calls than it needs." |
| "Rename this variable to userId." | "Should we use `userId` for this? `id` reads ambiguous next to the order id." |
| "You never test the error path." | "The error branch looks untested. Should we add a case for the throw?" |
| "You should cache this." | "Should we cache this? It runs on every request." |

## Clarity pass

After drafting every comment, run the whole batch through the `bd-technical-writing`
skill and apply its edits. Keep the anatomy and tone rules above; where the two disagree,
those rules win. Draft first, run the pass once over the batch, then hand the drafts to
the gate.
