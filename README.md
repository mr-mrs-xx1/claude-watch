<div align="center">

# Claude Watch

### See Inside Your AI Coding Sessions

**The open-source observability dashboard for Claude Code.**<br>
Visualize your project's logic, track changes, and search with AI — all in real time.

[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue)](https://www.linkedin.com/in/nir-diamant-759323134/)
[![Twitter](https://img.shields.io/twitter/follow/NirDiamantAI?label=Follow%20@NirDiamantAI&style=social)](https://twitter.com/NirDiamantAI)
[![Discord](https://img.shields.io/badge/Discord-Join%20our%20community-7289da?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/cA6Aa4uyDX)
[![Sponsor](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=ff69b4)](https://github.com/sponsors/NirDiamant)

</div>

---

## The Problem

When you use Claude Code, you're flying blind:

- Your project has **dozens of rules, prompts, and config files** — but you can't see them in one place
- Claude **silently changes logic** across sessions and you don't notice
- There's **no way to search** across all your project's instructions semantically
- You can't easily **track what changed** or roll back

## The Solution

Claude Watch **auto-discovers** every logic file in your project — system prompts, voice guides, rules, configs, playbooks — and presents them as an **interactive visual map** you can explore.

### Project Brain — Zoomable Bubble Graph

Your entire project logic as a visual map. Click to zoom in. Each bubble is a file, each inner bubble a section.

- Auto-discovers prompts, rules, configs, guides, templates, and documentation
- Color-coded by type, sized by content volume
- Critical rules (NEVER, MUST) highlighted with red/amber borders
- Click a section to read its rules in the detail panel

### AI-Powered Semantic Search

Ask natural language questions across all your project's logic:

> "What rules prevent making things up?"
> "How often should I post?"
> "What words are banned?"

- Uses Claude to understand intent, not just match keywords
- Returns only the actual rules — no structural noise
- Each result explained by AI: *"Anti-fabrication rules as PRIORITY #0, forbidding invented claims"*
- Falls back to keyword search if no API key is set

### Live Changes

See what Claude Code is doing in real time — file edits with diffs, commands with output, notifications. Only meaningful events, no noise.

### Snapshots

Save your project state before risky changes. Restore anytime. Git-powered, non-destructive.

---

## Quick Start

**3 commands. Under 2 minutes.**

```bash
# 1. Clone and build
git clone https://github.com/NirDiamant/claude-watch.git
cd claude-watch
npm install && cd dashboard && npm install && cd ..
npm run build

# 2. Start the dashboard
node dist/cli.js start

# 3. In your project directory, set up hooks
node /path/to/claude-watch/dist/cli.js init
```

The dashboard opens at **http://localhost:3853**. Use Claude Code normally — everything appears automatically.

### Enable AI Search (optional)

```bash
export ANTHROPIC_API_KEY=your-key-here
node dist/cli.js start
```

Without a key, search falls back to keyword matching.

---

## How It Works

```
Claude Code  ──hook──>  Claude Watch Server  ──websocket──>  Dashboard
                              │
                         SQLite DB
                       (~/.claude-watch/)
```

`claude-watch init` adds hooks to `.claude/settings.json`. Every tool call (Edit, Write, Bash, etc.) is captured, stored, and broadcast to the dashboard in real time.

The **brain scanner** walks your project directory and auto-classifies files:

| Detected As | Examples |
|---|---|
| **Prompts** | `SYSTEM_PROMPT.md`, `prompt.md`, `*.cursorrules` |
| **Rules** | `voice-guide.md`, `writing_guide.md`, playbooks |
| **Config** | `settings.json`, `.env.example`, `agent_config.json` |
| **Docs** | Templates, changelogs, architecture docs |
| **State** | Learnings, skills, growth plans, calendars |

Files are classified using filename patterns + content analysis (detecting keywords like NEVER, ALWAYS, MUST, PRIORITY, etc.).

---

## CLI Reference

| Command | What it does |
|---|---|
| `claude-watch start` | Launch the dashboard server |
| `claude-watch init` | Set up hooks in current project |
| `claude-watch init --global` | Set up hooks for all projects |
| `claude-watch snapshot <name>` | Save current project state |
| `claude-watch sessions` | List recent sessions |
| `claude-watch status` | Server status and stats |

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Cmd+K` | Focus search bar |
| `Esc` | Go back / close panel / clear search |
| Click bubble | Zoom into file or section |
| Click background | Zoom out |

---

## Architecture

| Component | Tech |
|---|---|
| Server | Express + WebSocket + better-sqlite3 |
| Dashboard | React + Vite + Tailwind + D3.js |
| CLI | Commander.js |
| AI Search | Claude API (Haiku) |
| Storage | SQLite at `~/.claude-watch/` |
| Integration | Claude Code hooks |

---

## Development

```bash
# Terminal 1 — server with hot reload
npm run dev

# Terminal 2 — dashboard with hot reload
npm run dev:dashboard
```

Vite proxies `/api` and `/ws` to the backend automatically.

---

## Contributing

Contributions are welcome! Some ideas:

- **More visualizations** — timeline view, dependency graph
- **Diff viewer** — side-by-side comparison of logic file versions
- **Export** — export project brain as PDF/markdown
- **Notifications** — alert when critical rules are modified
- **VS Code extension** — embed the dashboard in the editor

---

## 📫 Stay Updated

<div align="center">
<table>
<tr>
<td align="center">🚀<br><b>Cutting-edge<br>Updates</b></td>
<td align="center">💡<br><b>Expert<br>Insights</b></td>
<td align="center">🎯<br><b>Top 0.1%<br>Content</b></td>
</tr>
</table>

[![Subscribe to DiamantAI Newsletter](images/subscribe-button.svg)](https://diamantai.substack.com/?r=336pe4&utm_campaign=pub-share-checklist)

*Join over 50,000 AI enthusiasts getting unique cutting-edge insights and free tutorials!*
</div>

[![DiamantAI's newsletter](images/substack_image.png)](https://diamantai.substack.com/?r=336pe4&utm_campaign=pub-share-checklist)

---

## License

MIT
