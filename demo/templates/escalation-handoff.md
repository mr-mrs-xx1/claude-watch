# Escalation Handoff Template

## Customer-Facing Message

"Hi {name}, I want to make sure you get the best help here. I'm connecting you with {team_name} who can {specific_action}. They'll reach out within {SLA}. I've shared the full context so you won't need to repeat anything."

## Internal Handoff (for human agent)

### Summary
{one_sentence_summary}

### Context
- **Customer**: {name} ({plan_tier} plan, member since {date})
- **Category**: {category} | **Priority**: {priority}
- **Escalation reason**: {reason}

### What was tried
{list_of_steps_attempted}

### Recommended next step
{specific_action_for_human}

### Conversation history
{condensed_exchange_summary}

## Rules

- ALWAYS fill every field — incomplete handoffs waste human time
- NEVER include raw AI reasoning in the customer-facing message
- ALWAYS set the correct urgency level based on escalation rules
- MUST include what was already tried — prevents humans from repeating steps
