---
name: bd-technical-writing
description: >-
  Use when writing, rewriting, reviewing, or tightening technical prose:
  READMEs, guides, how-tos, runbooks, reference pages, design docs, RFCs,
  Confluence pages, agent instructions, error messages, PR descriptions, and
  commit messages. Also use when the user asks to make docs clearer, shorter,
  unambiguous, easier to scan, or easier to translate. Not for UI copy,
  marketing, or personal-voice prose.
argument-hint: "[file path or pasted text]"
---

# bd-technical-writing

Write so that a reader acts correctly after one read. Work through the six passes below in order. Each pass assumes the one before it is done.

## Pass 1: Keep the source true

A rewrite that reads better but says something different has failed. This pass outranks every rule after it.

- **Certainty.** Keep how sure the author is, and say it plainly. A requirement becomes a command or "must". A recommendation becomes "We recommend that you...". A possibility becomes "can" or "might". "You should probably restart the worker" becomes "We recommend that you restart the worker", never "Restart the worker". "Results may vary" never becomes "Results vary".
- **Qualifications.** Keep every limit on a claim: the version, the environment, the sample size, "up to", "only tested on X". A benchmark without its conditions is a different claim.
- **Nothing new.** Add no step, command, flag, default, page title, or fact that the source does not give.
- **Nothing lost.** Keep every instruction, including console and UI paths. Change how an instruction is worded, not whether it exists.
- **Links.** When you rewrite link text, keep the URL. Build the new text from the source's words or the URL's subject.
- **Gaps.** If the source contradicts itself or leaves out a step, keep its text and list the problem after your rewrite as a question for the author.

## Pass 2: Choose the document type

A reader comes to a page with one need. Ask two questions: does the reader want to act or to understand, and are they learning or working? The answer picks one type ([Diátaxis](https://diataxis.fr)):

| | Learning | Working |
|---|---|---|
| **Act** | Tutorial | How-to guide |
| **Understand** | Explanation | Reference |

- **Tutorial.** Lead a beginner to a working result. Say up front what they will have at the end. Give every step a result they can see, and show the expected output. Keep background to a clause and a link.
- **How-to guide.** Solve one problem for someone who already knows the basics. Steps only. Name it after the task: "Restore a backup", not "Backup restoration". Forks are fine: "If you use Kubernetes, ...".
- **Reference.** List facts for lookup: options, limits, errors, defaults. Follow the shape of the thing it documents, so the code and the page line up. No instructions, no opinions, no hedges of your own. A hedge from the source stays.
- **Explanation.** Answer a "why" question about one topic: the design, its history, its trade-offs. This is the only type where your judgment belongs.

When a page needs two types, split it into two pages and link them. History of how something used to work goes in a changelog or an explanation, not in a how-to.

## Pass 3: Write to the reader

Rules from the [Google developer documentation style guide](https://developers.google.com/style).

- Address the reader as "you". Use "we" only for the team or company that writes the doc.
- Use the present tense for how things work. Use "will" only for an event that happens later.
- Name the actor: "The scheduler retries the job", not "The job is retried". Use the passive only when the actor is unknown or does not matter.
- Write steps as commands: "Run the migration." Never "The migration should be run."
- Put the goal or condition first, the action second: "To free disk space, delete the cache." The reader can skip a sentence that does not apply to them.
- Lead with the common case. Put exceptions after it.
- Cut words that judge the task for the reader: "simply", "just", "easy", "quickly". Cut "please" from instructions.
- Don't describe future plans or announce features that do not exist yet. Remove "currently", "new", and "now" when the text must stay true next year.
- Use the short word: "use", not "utilize". "Before", not "prior to". "Start", not "commence".
- Call each thing by the name the code, the UI, or the CLI gives it. Don't invent a metaphor for it.

## Pass 4: Make every sentence read one way

Rules from ASD-STE100 Simplified Technical English and Kohl's *The Global English Style Guide*.

**Sentence size**
- One instruction per sentence. One idea per sentence elsewhere.
- Keep instructions to about 20 words and other sentences to about 25. Count a code span, command, identifier, or number with its unit as one word.
- Use simple tenses. "The tests are flaky on Fridays", not "have been flaky".
- Mix short and long sentences. A sentence can be long when it carries one idea with its condition.

**Word choice**
- Give each word one meaning, and each meaning one word. If "clear" means empty, never use it to mean approve. If you write "stop", don't switch to "halt".
- Keep the small words: "the", "a", "that". "Copy config file" can read as a heading or a command. "Copy the config file" reads one way.
- Use "-ing" words as little as you can. They can act as a noun, a verb, or an adjective, and the reader must guess which.
- No idioms, Latin abbreviations, or slang. "For example", not "e.g.". Name the items instead of "etc.".

**Structure**
- Put "only" and "not" directly next to the word they limit.
- Break a long stack of nouns: "the timeout value for the connection pool", not "the connection pool timeout value".
- Make every "it", "this", and "they" point to one noun. If there is any doubt, repeat the noun.
- Give every clause its verb. "The first job deletes the cache and the second the logs" leaves the second job without one.
- Use periods, not semicolons. Replace an em dash with a new sentence.
- No slashes: write "read, write, or both", not "read/write" or "and/or".

## Pass 5: Format for scanning

- **Headings** state the point: "Restore a backup", not "Backups". Use sentence case. A task heading starts with a verb. One H1 per page, and no skipped levels.
- **Lists.** Number the steps in a sequence. Use bullets for everything else. Introduce a list with a full sentence, and keep its items parallel.
- **Warnings** stand before the step they guard, with a label for the risk:
  - **Warning:** data loss, a security exposure, or harm to people.
  - **Caution:** damage you can recover from, such as a failed deploy.
  - **Note:** information only. A note never holds a step.
- **Code.** Put commands, paths, flags, and identifiers in code font. Show placeholders in capitals, such as `BACKUP_ID`, and say what each one stands for. Make every count or file tree true at the commit that lands it.
- **UI elements** are bold, with their exact label.
- **Links** say where they go. Never "click here". Point to the screen by name, not by position or color.

## Pass 6: Remove AI tells

Read the draft once more and remove each of these. Change only the phrase, not the sentences around it.

- **Chatbot framing.** Openers and sign-offs such as "Great question", "Let's dive in", "Here's what you need to know", and "I hope this helps".
- **Inflated claims.** "Robust", "seamless", "powerful", "pivotal", "game-changing", "blazingly fast". Give the measured fact, or cut the word.
- **Fake contrast.** "Not just X, it's Y" and "It isn't X, it's Y". State Y, but only if Y is a fact a reader can check. If Y is a pitch, such as "an end-to-end system", cut the sentence.
- **Forced threes.** A list padded to three items. Use the real number.
- **Empty "-ing" tails.** ", ensuring...", ", highlighting...", ", empowering...". Cut the tail, or make it a sentence with a real subject.
- **Label-and-colon bullets.** "**Speed:** Deploys are fast." Write the fact as a plain sentence or a plain bullet. This rule does not cover the **Warning:**, **Caution:**, and **Note:** labels from Pass 5.
- **Decoration.** Emoji, Title Case Headings, bold used for emphasis, and exclamation marks.
- **Abstract metaphors.** "Substrate", "north star", "flywheel", "surface area", "wedge". Write the concrete word.
- **Over-compression.** Arrows, dropped articles, and fragments such as "Bad input → exit 2, no write". Write the full sentence.

Then check the result against Pass 1 and the sentence limits in Pass 4 again.

## PRs and commits

Passes 1, 3, 4, 5, and 6 apply. A PR description is a briefing for a reviewer with one minute: what changed, why, and what could break. Link logs, metrics, and long output instead of pasting them.

## Example

Before:

> The cache can be flushed via the admin panel (the red button at the top) or alternatively you could run `cachectl flush --all` which basically clears everything, so be careful since this will log all users out!! This should probably only be done off-peak.

After:

> **Warning:** Flushing the cache logs out all users. We recommend that you flush it only off-peak.
>
> To flush the cache, do one of these:
>
> - In the admin panel, click the red button at the top.
> - Run `cachectl flush --all`.
>
> Question for the author: what is the label of the flush button in the admin panel?

The rewrite moves the risk before the steps and labels it. "Should probably" stays a recommendation, and both ways to flush survive. The button keeps the source's description, because the source gives no label. The rewrite asks the author for one instead of inventing it.

## Never

- Change what the source claims, how sure it is, or what it qualifies.
- Add a step, command, flag, name, or fact that the source does not give.
- Drop an instruction because a rule made it awkward. Rewrite it.
- Mix two document types on one page.
- Put a step inside a note.
