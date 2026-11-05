---
name: bd-bdd
description: Use when the user asks for BDD or Gherkin test scenarios for a feature in progress — to paste into a PR's Demo/evidence section or hand to an e2e/browser tester. Triggers on "bd-bdd", "write test scenarios", "write Gherkin/BDD scenarios for this feature", "there are no test scenarios yet". Manual only; not for writing executable step definitions or test code.
argument-hint: "[ticket key, spec/plan path, or blank for the current branch]"
---

# bd-bdd

Write the Gherkin scenarios a feature will be judged by. Two readers: PR reviewers, who
check the change against them, and any automated runner (browser-tester, `/test`,
Playwright, Cypress), which follows them as a script. Both need the same thing: steps a
person could perform by hand and results they could see.

## Step 1: Reuse existing scenarios

Search, in order: an implementation plan (a `bd-plan` "Behaviour scenarios" section), the
ticket, the requirements page, the PR body.

**If any exist:** return those scenarios as Gherkin, keeping each one's meaning. Don't add
scenarios to the set. Gaps you notice (a requirement no scenario covers, a conflict) go
under **Open questions**, so the user decides whether to extend the set. Stop here.

## Step 2: Gather sources

Use every source that exists and record each one: ticket (Jira, GitHub issue), requirements
page (Confluence, a pasted spec), design (Figma), and the branch diff
(`git diff <base>...HEAD`). A connector that isn't available is a missing source, not an
error. Note it in Sources and carry on.

## Step 3: Write the scenarios

**If the change adds or alters no behaviour a user can see** (a refactor, a dependency
bump, infra), reply with the Sources line and one sentence saying there is nothing new
for scenarios to check, and name where its proof belongs instead (unit or snapshot tests).
Stop. "Behaviour stays the same" is not a requirement to write scenarios for.

**One scenario per requirement a source states.** UI micro-states (a button appearing, a
selection clearing) are steps inside those scenarios, not scenarios of their own. Use
`Scenario Outline` + `Examples` when only the data changes.

**Each scenario carries its origin** as a comment line directly above it:
`# from: ticket AC3`, `# from: requirements "Mark as paid in bulk"`, `# from: diff`.
Behaviour that no source states, such as a cancel button nobody asked for or an error
path nobody specified, is not a scenario. It goes under **Open questions**.

**Steps a runner can follow without guessing:**

- **Given**: a named role, specific data (invoice numbers, amounts, counts), and the page
  the user is on.
- **When**: one action a person takes.
- **Then**: something visible on screen, in a downloaded file, or in an email, with the
  exact text where the source or diff gives it. If the only proof is stored data (a saved
  date, an audit row) and no screen shows it, it is an open question for the tester, not a
  Then.

Write in user words: screen labels and messages, never selectors, test IDs, component,
hook, table, or mutation names, HTTP verbs, or raw enum values (`UNPAID`). Where the API
*is* the product, its consumer is the user.

## Output

Reply in chat with these parts, in order, and don't edit the PR:

1. **Sources**: one line listing what you used and what was missing.
2. A ```gherkin block: one `Feature:`, then the scenarios, each with its `# from:` line.
3. **Open questions**: conflicts between sources, behaviour no source states, and Thens
   only stored data could prove. Omit the heading when empty.
4. **Likely to fail against the current code**: scenarios the diff won't satisfy yet, one
   line each with the reason. Omit when empty or when there's no diff.

## Example

```gherkin
Feature: Bulk mark invoices as paid

  # from: ticket AC1-AC4
  Scenario: Finance user marks several invoices paid
    Given I am a finance user on the Invoices page with unpaid invoices INV-1001, INV-1002 and INV-1003
    When I select all three and confirm "Mark as paid" with today's date
    Then the three rows show status "Paid"
    And I see "3 invoices marked as paid"

  # from: requirements "Mark as paid in bulk"; diff
  Scenario: Some invoices fail and the rest stay paid
    Given I am a finance user with INV-1001 and INV-1002 selected
    And another user voids INV-1002 before I confirm
    When I confirm "Mark as paid"
    Then INV-1001 shows status "Paid"
    And I see "Couldn't mark INV-1002 as paid"
```

## Never

- Add scenarios to a set you found in Step 1.
- Write a scenario for behaviour no source states.
- Put a selector, test ID, code identifier, or database check in a step.
- Edit the PR body. The user pastes the block.
