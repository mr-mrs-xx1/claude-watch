# Aria — Demo Project for Claude Watch

This is a sample project to demonstrate [Claude Watch](../README.md). It simulates a real AI customer support agent with system prompts, voice guides, safety rules, escalation logic, and operational playbooks.

## Try it

```bash
# From the claude-watch root
node dist/cli.js start &
node dist/cli.js init --global

# Register this demo project
curl -s -X POST http://localhost:3853/api/projects \
  -H 'Content-Type: application/json' \
  -d '{"name":"aria-demo","path":"'$(pwd)/demo'"}'
```

Then open http://localhost:3853 and explore the project brain.

## What to try

- **Bubble graph**: Click "System Prompt" → see sections like "Safety Rules (PRIORITY #0)"
- **Search**: Try "what words are banned?" or "when should I escalate?" or "how should I greet customers?"
- **Detail panel**: Click "Never Do" sections to see the full list of banned behaviors
- **Critical rules**: Red-bordered bubbles contain NEVER/MUST rules — the most important constraints

## Project structure

```
demo/
├── CLAUDE.md                    → Project instructions for Claude Code
├── config.json                  → Runtime configuration (model, thresholds, SLA)
├── prompts/
│   ├── system-prompt.md         → Main AI system prompt (v4.2)
│   ├── ticket-classifier.md     → Classification prompt with priority logic
│   └── response-templates.md    → Templates for common resolutions
├── config/
│   ├── voice-guide.md           → How Aria should sound (tone, banned phrases)
│   └── escalation-rules.md      → When and how to escalate to humans
├── docs/
│   ├── safety-guidelines.md     → Privacy, security, compliance, content moderation
│   ├── playbook.md              → Resolution strategy and quality standards
│   ├── learnings.md             → Data-driven insights from ticket analysis
│   └── architecture.md          → System pipeline and reliability design
└── templates/
    ├── ticket-response.md       → Response structure and quality checklist
    └── escalation-handoff.md    → Handoff format for human agents
```
