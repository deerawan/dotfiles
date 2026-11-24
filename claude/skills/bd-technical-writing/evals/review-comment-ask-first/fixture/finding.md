# Verified review finding (draft one inline PR comment from this)

- Severity: Important. Action: ask the author.
- File: packages/sdk/entities/InvoiceCustomerLink.ts, lines 12-17.
- The entity's primary key `customer` is typed `number`, a scalar `@PrimaryKey({ fieldName: 'customer_id', autoincrement: false })`.
- Migration V42 creates an FK from `billing.invoice_customer_link.customer_id` to `accounts.customer(id)`.
- In the earlier, closed PR #310, the same entity was generated as `@OneToOne({ entity: () => Customer, primary: true }) customer!: Customer`.
- Sibling entity AccountProfile.ts also models its PK-that-is-an-FK as `@OneToOne` with `primary: true`.
- `generate-entities.ts` deletes the entities folder and regenerates it, so the next `sync-entities` run will likely flip the type back to `Customer` and break callers that rely on `number`.
- Uncertain: MikroORM's generator can emit a scalar when it cannot see the referenced table, so this might be real generator output.
- Possible remedies: rerun `sync-entities` to see what the generator produces; or, if the scalar is intended, rename the field to `customerId`.
- Comment anatomy required by the review tool: first line `[<Severity>] <subject>`, then body. Talk about the code, not the author; use "we" for proposed changes; one ask per comment.
