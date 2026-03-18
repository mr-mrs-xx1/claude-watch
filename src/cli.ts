import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { startServer } from './server/index.js';
import { startSessionCleanup } from './services/session-manager.js';

const DEFAULT_PORT = 3853;
const HOOK_COMMAND = `curl -s -X POST http://localhost:${DEFAULT_PORT}/api/events -H 'Content-Type: application/json' -d "$(cat)"`;

const program = new Command();

program
  .name('claude-watch')
  .description('Real-time observability dashboard for Claude Code')
  .version('0.1.0');

program
  .command('start')
  .description('Start the Claude Watch dashboard server')
  .option('-p, --port <port>', 'Port to listen on', String(DEFAULT_PORT))
  .option('--dev', 'Development mode (dashboard served separately)')
  .option('--no-open', 'Do not open browser automatically')
  .action(async (options) => {
    const port = parseInt(options.port);

    console.log(chalk.bold.blue(`
  ╔═══════════════════════════════════════╗
  ║         🔍 Claude Watch v0.1         ║
  ║   Real-time Claude Code Observability ║
  ╚═══════════════════════════════════════╝
`));

    await startServer({ port, dev: options.dev });
    startSessionCleanup();

    console.log(chalk.green(`  ✓ Server running on http://localhost:${port}`));
    console.log(chalk.gray(`  ✓ WebSocket on ws://localhost:${port}/ws`));
    console.log(chalk.gray(`  ✓ Data stored in ~/.claude-watch/\n`));

    if (options.open && !options.dev) {
      try {
        const open = (await import('open')).default;
        await open(`http://localhost:${port}`);
        console.log(chalk.green('  ✓ Dashboard opened in browser\n'));
      } catch {
        console.log(chalk.yellow(`  → Open http://localhost:${port} in your browser\n`));
      }
    }

    console.log(chalk.dim('  Waiting for Claude Code events...\n'));
  });

program
  .command('init')
  .description('Configure Claude Code hooks for the current project')
  .option('--global', 'Configure hooks globally for all projects')
  .option('-p, --port <port>', 'Claude Watch server port', String(DEFAULT_PORT))
  .action((options) => {
    const port = parseInt(options.port);
    const hookCommand = `curl -s -X POST http://localhost:${port}/api/events -H 'Content-Type: application/json' -d "$(cat)"`;

    const settingsPath = options.global
      ? path.join(os.homedir(), '.claude', 'settings.json')
      : path.join(process.cwd(), '.claude', 'settings.json');

    const settingsDir = path.dirname(settingsPath);
    fs.mkdirSync(settingsDir, { recursive: true });

    let settings: Record<string, unknown> = {};
    if (fs.existsSync(settingsPath)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      } catch {
        // Start fresh if invalid JSON
      }
    }

    // Add hooks
    const hooks = (settings.hooks || {}) as Record<string, unknown[]>;

    const hookEntry = { matcher: '', command: hookCommand };

    // Add to each hook type if not already present
    for (const hookType of ['PostToolUse', 'Notification', 'Stop']) {
      const existing = (hooks[hookType] || []) as Array<{ command?: string }>;
      const alreadyConfigured = existing.some(h => h.command?.includes('claude-watch') || h.command?.includes(`:${port}/api/events`));
      if (!alreadyConfigured) {
        hooks[hookType] = [...existing, hookEntry];
      }
    }

    settings.hooks = hooks;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

    const scope = options.global ? 'global' : 'project';
    console.log(chalk.green(`\n  ✓ Claude Code hooks configured (${scope})`));
    console.log(chalk.gray(`  → Settings written to ${settingsPath}`));
    console.log(chalk.gray(`  → Events will be sent to http://localhost:${port}/api/events\n`));

    if (!options.global) {
      // Also register the project
      const projectPath = process.cwd();
      const projectName = path.basename(projectPath);
      console.log(chalk.dim(`  Registering project "${projectName}"...`));

      fetch(`http://localhost:${port}/api/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: projectName, path: projectPath }),
      })
        .then(() => console.log(chalk.green(`  ✓ Project registered\n`)))
        .catch(() => console.log(chalk.yellow(`  → Start claude-watch server first: ${chalk.bold('claude-watch start')}\n`)));
    }

    console.log(chalk.bold('  Next steps:'));
    console.log(chalk.gray('  1. Start the dashboard:  claude-watch start'));
    console.log(chalk.gray('  2. Use Claude Code normally — events will appear in the dashboard\n'));
  });

program
  .command('snapshot')
  .description('Create a snapshot of the current project state')
  .argument('<name>', 'Snapshot name')
  .option('-d, --description <desc>', 'Snapshot description')
  .option('-p, --port <port>', 'Claude Watch server port', String(DEFAULT_PORT))
  .action(async (name, options) => {
    const port = parseInt(options.port);
    const projectPath = process.cwd();

    try {
      // Find the project
      const projectsRes = await fetch(`http://localhost:${port}/api/projects`);
      const projects = await projectsRes.json() as Array<{ id: string; path: string }>;
      const project = projects.find((p) => p.path === projectPath);

      if (!project) {
        console.log(chalk.red('\n  ✗ Project not found. Run `claude-watch init` first.\n'));
        return;
      }

      const res = await fetch(`http://localhost:${port}/api/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: project.id,
          name,
          description: options.description,
        }),
      });

      const snapshot = await res.json();
      console.log(chalk.green(`\n  ✓ Snapshot "${name}" created`));
      if ((snapshot as { git_ref?: string }).git_ref) {
        console.log(chalk.gray(`  → Git ref: ${(snapshot as { git_ref: string }).git_ref}`));
      }
      console.log();
    } catch {
      console.log(chalk.red(`\n  ✗ Failed to create snapshot. Is the server running?\n`));
    }
  });

program
  .command('sessions')
  .description('List recent sessions')
  .option('-p, --port <port>', 'Claude Watch server port', String(DEFAULT_PORT))
  .action(async (options) => {
    const port = parseInt(options.port);

    try {
      const res = await fetch(`http://localhost:${port}/api/sessions`);
      const sessions = await res.json() as Array<{
        id: string;
        project_name: string;
        status: string;
        started_at: string;
        event_count: number;
        summary?: string;
      }>;

      if (!Array.isArray(sessions) || sessions.length === 0) {
        console.log(chalk.yellow('\n  No sessions found.\n'));
        return;
      }

      console.log(chalk.bold('\n  Recent Sessions:\n'));
      for (const s of sessions.slice(0, 20)) {
        const statusIcon = s.status === 'active' ? chalk.green('●') : chalk.gray('○');
        const time = new Date(s.started_at).toLocaleString();
        console.log(`  ${statusIcon} ${chalk.bold(s.project_name)} — ${s.event_count} events — ${time}`);
        if (s.summary) console.log(chalk.gray(`    ${s.summary}`));
      }
      console.log();
    } catch {
      console.log(chalk.red(`\n  ✗ Failed to fetch sessions. Is the server running?\n`));
    }
  });

program
  .command('status')
  .description('Show Claude Watch status')
  .option('-p, --port <port>', 'Claude Watch server port', String(DEFAULT_PORT))
  .action(async (options) => {
    const port = parseInt(options.port);

    try {
      const [healthRes, statsRes] = await Promise.all([
        fetch(`http://localhost:${port}/api/health`),
        fetch(`http://localhost:${port}/api/events/stats`),
      ]);

      const health = await healthRes.json() as { status: string; uptime: number };
      const stats = await statsRes.json() as {
        total_projects: number;
        active_sessions: number;
        total_events_today: number;
        total_snapshots: number;
      };

      console.log(chalk.bold('\n  Claude Watch Status:\n'));
      console.log(`  ${chalk.green('●')} Server running on port ${port}`);
      console.log(chalk.gray(`    Uptime: ${Math.floor(health.uptime / 60)}m ${Math.floor(health.uptime % 60)}s`));
      console.log(`\n  Projects:        ${chalk.bold(String(stats.total_projects))}`);
      console.log(`  Active sessions: ${chalk.bold(String(stats.active_sessions))}`);
      console.log(`  Events today:    ${chalk.bold(String(stats.total_events_today))}`);
      console.log(`  Snapshots:       ${chalk.bold(String(stats.total_snapshots))}`);
      console.log();
    } catch {
      console.log(chalk.red(`\n  ✗ Server not running on port ${port}\n`));
    }
  });

program.parse();
