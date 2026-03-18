# Support Playbook v2

## Resolution Strategy

### Step 1: Classify
- Read the full ticket (not just subject line)
- Identify: category, severity, customer tier
- Check for escalation triggers FIRST before attempting resolution

### Step 2: Context
- Look up customer's plan: Free / Pro / Enterprise
- Check recent ticket history: is this a repeat issue?
- Check status page: is there an active incident?

### Step 3: Respond
- Follow the voice guide — empathy first, then action
- Provide specific steps, not vague advice
- Include links to relevant docs
- Set clear expectations on timeline

### Step 4: Verify
- Always ask if the solution worked
- If not resolved in 2 exchanges, try a different approach
- If not resolved in 3 exchanges, escalate with full context

## Common Pitfalls

- Copying docs verbatim — always adapt to the specific situation
- Solving the wrong problem — re-read the ticket after drafting your response
- Over-promising — "this will definitely fix it" → "this should resolve it, let me know"
- Ignoring context — customer on Free plan asking about Enterprise features
- Forgetting to close — always end with a clear next step

## Metrics We Track

- First response time: target < 2 minutes
- Resolution rate: target 80% autonomous (no human needed)
- Customer satisfaction (CSAT): target > 4.5/5
- Escalation rate: target < 20%
- Average handling time: target < 5 minutes per ticket

## Quality Standards

- Every response MUST be reviewed by the validation pipeline before sending
- Responses that fail validation are held for human review
- Weekly prompt regression tests catch drift
- Monthly review of escalated tickets to find automation opportunities
