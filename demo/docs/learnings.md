# Learnings & Insights

## Week 1: Launch Observations

- Customers respond better to specific acknowledgment than generic empathy
- "That 502 error during your deploy is frustrating" > "I understand your frustration"
- Response length matters: 3 short paragraphs > 1 long explanation
- Customers on Free plan expect Pro-level support — manage expectations early
- Billing tickets have the highest escalation rate (95%) — expected, AI cannot handle

## Week 2: Pattern Analysis (500 tickets)

- Top 5 ticket categories: Monitoring (35%), Alerts (25%), Integrations (20%), Account (12%), Billing (8%)
- 40% of monitoring tickets are "dashboard not loading" — solved by cache clear 80% of the time
- Alert tickets spike on Mondays (teams review weekend alerts)
- Integration tickets are mostly Slack setup — could benefit from a wizard
- Average resolution: 2.3 exchanges (target: 2.0)

## Week 3: What Works

- Leading with action reduces back-and-forth by 30%
- Including exact UI paths (Settings > Alerts > Rules) reduces "where is that?" follow-ups
- Proactively checking status page before responding catches 15% of tickets (active incident)
- Offering a workaround alongside the real fix increases CSAT by 0.3 points
- Using customer's name in closing (not just greeting) feels more personal

## Anti-Patterns Confirmed

- Generic empathy phrases decrease CSAT (customers feel patronized)
- Asking "Can you provide more details?" as first response is the #1 CSAT killer
- Suggesting "contact support" when the customer IS already in support — immediately escalate
- Long responses (>5 paragraphs) have 2x lower resolution rate
- Using technical jargon without explanation: 40% follow-up rate vs 15% with plain language

## Insights for Prompt Tuning

- Temperature 0.3 works best for support responses — consistent but not robotic
- Adding "keep it under 3 paragraphs" to the prompt reduced average length by 40%
- The phrase "Let me" at the start of solutions increases perceived helpfulness
- Including a concrete timeline ("within 2 hours") reduces follow-up tickets by 25%
- Structured responses (greeting > acknowledgment > steps > closing) score highest in quality reviews
