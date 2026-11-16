# Retry for outbound webhook deliveries (notifications service)

Today: when a partner webhook returns 5xx, `WebhookSender.send()` throws and the delivery is lost. Product wants at-least-once delivery with retries over ~24h.

Option A: Postgres outbox. Insert a `webhook_delivery` row in the same transaction as the business write. A worker polls `SELECT ... FOR UPDATE SKIP LOCKED` every 5s, sends, and updates `attempts`/`next_attempt_at` with exponential backoff. We already run Postgres 15 and a NestJS worker pool. Peak volume ~40 deliveries/min.

Option B: SQS with a DLQ. Publish a message after the business write commits. A consumer sends; on failure, it changes message visibility for backoff (max 12h visibility timeout), maxReceiveCount 10 then DLQ. We use SQS in two other services. Publishing happens after commit, so a crash between commit and publish loses the delivery unless we add an outbox anyway.

Team constraints: one on-call engineer; Pulumi manages AWS; the team has never operated SKIP LOCKED polling in production.
