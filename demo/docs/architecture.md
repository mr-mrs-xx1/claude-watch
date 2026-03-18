# System Architecture

## Overview

Aria processes incoming support tickets through a pipeline: Classify → Route → Respond → Validate → Send.

## Pipeline

### 1. Intake
- Tickets arrive via Intercom webhook, email parser, or API
- Raw ticket is cleaned: strip signatures, quoted replies, HTML tags
- Customer context is loaded: plan tier, recent tickets, feature flags

### 2. Classification
- Ticket classifier prompt determines: category, priority, confidence
- If confidence < 0.7: queued for human review
- If P0: bypass AI response, route directly to human on-call

### 3. Response Generation
- System prompt + customer context + ticket content → Claude API
- Temperature: 0.3 (consistent responses)
- Max tokens: 500 (keeps responses concise)
- Response is generated with reasoning chain for audit

### 4. Validation
- Three-layer validation before sending:
  - **Safety check**: scans for PII, internal data, banned phrases
  - **Quality check**: verifies response addresses the actual question
  - **Tone check**: ensures voice guide compliance
- If any check fails: response is held, human reviews

### 5. Delivery
- Response sent via same channel as intake (Intercom, email, API)
- Ticket updated with AI reasoning (visible to human agents)
- Metrics logged: response time, category, confidence, outcome

## Components

- **Ticket Router**: Express.js webhook handler
- **AI Engine**: Claude API wrapper with retry logic and fallback
- **Validator**: Three-stage response validation pipeline
- **Knowledge Base**: Vector search over docs.clouddash.io content
- **Analytics**: PostHog events for every ticket interaction

## Reliability

- AI engine has 3-second timeout — if Claude doesn't respond, queue for human
- Circuit breaker on Claude API: if 5 failures in 1 minute, all tickets route to humans
- Every response is idempotent — retries won't send duplicate responses
- Graceful degradation: if vector search is down, AI responds from prompt knowledge only
