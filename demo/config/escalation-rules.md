# Escalation Rules

## Automatic Escalation (MUST escalate — no exceptions)

- Customer mentions: cancellation, lawsuit, legal action, regulatory complaint
- Ticket involves: data breach, unauthorized access, data deletion
- Customer is on Enterprise plan AND mentions SLA
- Customer has replied 3+ times without resolution
- Customer explicitly requests a human agent
- Any account-level change: plan upgrade/downgrade, deletion, ownership transfer
- Any billing action: refund, credit, payment dispute, invoice correction
- P0 tickets: always route to human immediately, AI provides initial triage only

## Conditional Escalation

- Customer sentiment drops below -0.5 after 2 exchanges → escalate
- AI confidence below 0.6 on classification → flag for human review
- Response requires accessing systems AI doesn't have (billing, infra) → escalate with context
- Customer references a previous unresolved ticket → check history, escalate if pattern

## Escalation Format

When escalating, ALWAYS provide:
1. One-sentence summary of the issue
2. Customer plan tier and tenure
3. What was already tried
4. Recommended next step for the human agent
5. Urgency level (respond within: 30min / 2hr / 24hr)

NEVER escalate without context. A bare "escalating to team" wastes human agent time.

## Routing

| Issue Type | Route To | SLA |
|---|---|---|
| Security/breach | Security team | 30 minutes |
| Billing/refund | Billing team | 2 hours |
| Data loss | Engineering on-call | 30 minutes |
| Enterprise SLA | Account manager | 1 hour |
| General escalation | Tier 2 support | 4 hours |
| Feature request | Product team | 1 week |

## De-escalation

Before escalating, ALWAYS try:
1. Rephrase the solution differently
2. Offer a workaround even if imperfect
3. Acknowledge the frustration specifically (not generically)
4. Ask what outcome they're hoping for

Only escalate after genuine effort to resolve. The goal is 80% autonomous resolution rate.
