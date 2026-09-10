# Comment style — posted PR comments

Applies only to the inline comments bd-code-review posts to a teammate's PR. The
terminal report is unaffected — keep it terse.

## Anatomy

```
[<Severity>] <one-line subject: what, and where>

<why it matters, 1–2 sentences, then the concrete fix or the open question.>
```

Severity is the finding's existing **Critical / Important / Nitpick**. One comment,
one ask.

## Tone

- Talk about the code, not the person: "this code requests the service twice", never
  "you request…".
- Ask, don't demand, on naming and judgment calls: "What do you think about `userId`
  here?" not "Rename this to userId."
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
| "Rename this variable to userId." | "What do you think about `userId` for this? `id` reads ambiguous next to the order id." |
| "You never test the error path." | "The error branch looks untested. Worth a case for the throw?" |

## Voice + humanizer

After drafting every comment, run the whole batch through the humanizer skill
(`humanizer:humanizer`) in embedded mode — it returns only the final text — with
`~/.claude/VOICE.md` as the voice reference. Draft first, humanize once over the batch,
then hand the drafts to the gate. Contractions, no em dashes, restrained emoji, reason
stated with "because" — the reviewer-side match to bd-receiving-review's author-voice
replies.
