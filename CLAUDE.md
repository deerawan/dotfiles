# CLAUDE.md

This repo is public and must stay generic.

- Use generic names in skills, examples, evals and configs: `app`, `api`, `web`, `acme`, `example.com`, `FOO-123`.
- Never mention an employer, client, product, internal app, repo, package scope, monorepo tool, ticket prefix, person or internal URL.
- Skills must work in both the Claude Code CLI and the desktop app. Any step that uses a desktop-only tool (`spawn_task`, `start_session`, other `mcp__ccd_*`, scheduled tasks) also states its CLI fallback.
- Before committing, grep the diff for employer-specific terms and replace any hits with generic ones.
