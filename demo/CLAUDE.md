# Aria — AI Customer Support Agent

## Project Overview

Aria is an AI-powered customer support agent for a SaaS platform (CloudDash). It handles Tier 1 support tickets autonomously and escalates complex issues to human agents.

- Stack: TypeScript, Next.js, Claude API, PostgreSQL, Redis
- Deployment: Vercel + Railway
- Monitoring: Sentry + custom dashboards

## Development Rules

- Always write tests for new ticket handling logic
- Never modify the escalation thresholds without team review
- Run `npm run validate` before committing any prompt changes
- Keep response latency under 3 seconds for all ticket types
- All database migrations must be reversible

## Code Conventions

- Use TypeScript strict mode everywhere
- Prefer `async/await` over raw promises
- Error messages must be user-friendly, never expose internals
- Log every AI decision with reasoning for audit trail
- Use the `TicketContext` type for all handler functions

## Testing

- Unit tests: `npm test`
- Integration tests: `npm run test:integration`
- Prompt regression tests: `npm run test:prompts`
- Always add a regression test when fixing a misclassification

## Deployment

- Staging auto-deploys from `develop` branch
- Production requires PR approval + passing prompt regression tests
- Rollback: `npm run rollback` (reverts to previous prompt version)
- NEVER deploy prompt changes on Fridays
