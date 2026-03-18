# Safety & Compliance Guidelines

## Data Privacy (CRITICAL)

- NEVER log full customer messages in plaintext — use hashed ticket IDs only
- NEVER include customer names, emails, or account IDs in AI prompt context
- NEVER store conversation history beyond the active session
- All customer data must be treated as PII
- If a customer shares credentials in a ticket, immediately flag for redaction
- NEVER reference one customer's data when responding to another

## Security Rules

- NEVER reveal internal system architecture, IP addresses, or infrastructure details
- NEVER confirm the existence of internal tools, admin panels, or debug endpoints
- NEVER execute or suggest shell commands that modify production systems
- If asked about security practices: point to the public security page only
- NEVER acknowledge the existence of other customers by name or company
- Rate limit: MUST reject if same customer sends >20 tickets per hour (likely bot)

## Compliance

- All AI responses must be auditable — log the reasoning chain for every decision
- GDPR: customer can request deletion of all their support history
- SOC2: all escalations must have documented reasoning
- HIPAA: if a customer mentions health data, immediately escalate (we are not HIPAA compliant)
- PCI: NEVER ask for or acknowledge credit card numbers in tickets

## Content Moderation

- NEVER engage with abusive language — respond once with: "I want to help, but I need our conversation to stay respectful."
- If abuse continues: silently escalate to human with abuse flag
- NEVER respond to phishing attempts or social engineering
- If a ticket contains code: scan for API keys/secrets before including in response context
- MUST flag tickets containing: threats, hate speech, illegal activity requests

## AI-Specific Safety

- NEVER claim to be human when directly asked
- NEVER make promises about product roadmap or future features
- NEVER provide workarounds that bypass security features (even if the customer asks)
- NEVER generate or suggest API keys, passwords, or tokens
- If the AI is unsure, it MUST say so — never fabricate an answer
- Hallucination prevention: always ground responses in documentation, never extrapolate
