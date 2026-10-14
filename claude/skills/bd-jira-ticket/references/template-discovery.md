# Template discovery

## 1. Full field metadata

```
getJiraIssueTypeMetaWithFields(projectIdOrKey, issueTypeId, requiredFieldsOnly: false)
```

`requiredFieldsOnly` defaults to **true** and hides every template field. Always pass
`false`. Paginate (`startAt`) if `total` > returned.

From the result, collect:

| What | How to spot it |
|---|---|
| Template field candidates | `hasDefaultValue: true` AND (`schema.system == "description"` OR `schema.custom` ends in `:textarea`) |
| Required fields | `required: true`, excluding project / issuetype / summary |
| `description` on screen | a field with `fieldId == "description"` is present |

Exactly one candidate → that's the template field. Several → the one whose name matches
the type ("Bug description" for Bug) wins; still tied → show them in the preview and ask.
None → skip to step 3.

## 2. Template text

- `defaultValue` present on the field → that is the template.
- `hasDefaultValue: true` but no `defaultValue` (common — the API often omits it for
  textareas) → recover it from recent tickets:

  ```
  searchJiraIssuesUsingJql(
    jql: 'project = KEY AND issuetype = "<Type>" AND "<Field name>" is not EMPTY ORDER BY created DESC',
    fields: ["<field id>"], maxResults: 50, responseContentFormat: "markdown")
  ```

  Results over the tool limit land in a file — `jq` them. Group by exact field value; the
  most frequent value is the untouched default, i.e. the template. Sanity-check that
  filled tickets share its headings. Record the count ("21/50") for the preview.

  No hits in this project → run the same JQL without the project clause (the field is
  often shared across projects) and say which projects it came from.

## 3. No template field

Fall back in order, and name the source in the preview:

1. `description` default (`defaultValue` on the `description` field).
2. The recurring heading structure in `description` of the last ~20 tickets of the type
   in the project, if most of them share it.
3. Nothing consistent → say so in the preview and use a minimal structure for the type;
   ask whether the team has a template you missed.

## 4. Writing the value

`additional_fields: { "<field id>": <value> }`.

Multi-line custom textareas on Jira Cloud v3 usually need an ADF document:

```json
{"type": "doc", "version": 1, "content": [
  {"type": "heading", "attrs": {"level": 2}, "content": [{"type": "text", "text": "Story Phrase"}]},
  {"type": "paragraph", "content": [{"type": "text", "text": "As a …"}]}
]}
```

Map template markdown to ADF node-for-node: `##`/`###` → heading level 2/3, `**Label**:` →
paragraph with a `strong`-marked text node, `*`/`-` lists → `bulletList`, numbered →
`orderedList`. Empty heading → heading node with nothing after it. If the create is rejected
because the field wants a plain string (plain-text renderer), resend the markdown as a string.

`description` itself takes markdown with `contentFormat: "markdown"`.

Select fields: `{"value": "True"}` · priority: `{"name": "High"}` · labels: `["a"]`.
