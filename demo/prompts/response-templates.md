# Response Templates

## Greeting

Use based on ticket priority:

- **P0/P1**: "Hi {name}, I can see this is urgent — let me help right away."
- **P2**: "Hi {name}, thanks for reaching out! Let me look into this for you."
- **P3**: "Hi {name}, great question!"

## Common Resolutions

### Dashboard Not Loading

1. Clear your browser cache (Ctrl+Shift+Delete)
2. Try an incognito/private window
3. Check if the issue persists at status.clouddash.io
4. If using a VPN, try disconnecting temporarily

If none work: "I've flagged this for our engineering team. We'll investigate and update you within 2 hours."

### Alert Not Firing

1. Go to Alerts > Rules and verify the rule is enabled (green toggle)
2. Check the threshold — it may need adjustment based on your baseline
3. Verify the notification channel: Alerts > Channels > Test
4. Check the evaluation window — alerts with 5min windows may miss brief spikes

### Integration Setup (Slack)

1. Go to Settings > Integrations > Slack
2. Click "Connect Workspace" and authorize CloudDash
3. Select the channel for notifications
4. Send a test alert to verify

### Billing Questions

NEVER answer billing questions directly. Always:
1. Acknowledge the question
2. Say: "Let me connect you with our billing team who can help with this directly."
3. Escalate with tag: billing-escalation

## Closing

- After resolution: "Does this resolve the issue? I'm here if you need anything else."
- After escalation: "I've connected you with our {team} team. They'll reach out within {SLA_HOURS} hours."
- ALWAYS offer to keep the ticket open: "I'll keep this ticket open in case you need follow-up."
