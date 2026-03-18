import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { getDb } from '../db.js';
import { scanProjectBrain } from '../../services/brain-scanner.js';
import { buildLogicTree } from '../../services/tree-builder.js';

const router = Router();

// Get the logic tree — interactive hierarchy of all instructions
router.get('/:projectId/tree', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as
    | { id: string; name: string; path: string } | undefined;

  if (!project) return res.status(404).json({ error: 'Project not found' });

  try {
    const scan = scanProjectBrain(project.path);
    const tree = buildLogicTree(scan.files, project.name);
    res.json({ tree, file_count: scan.files.length, change_count: scan.recent_changes.length });
  } catch (err) {
    res.status(500).json({ error: 'Scan failed', details: String(err) });
  }
});

// Full scan (raw data)
router.get('/:projectId', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as
    | { id: string; path: string } | undefined;

  if (!project) return res.status(404).json({ error: 'Project not found' });

  try {
    const scan = scanProjectBrain(project.path);

    // Also include Claude Code specific files (memory, global settings)
    const claudeData = getClaudeCodeData(project.path);

    res.json({ ...scan, claude_code: claudeData });
  } catch (err) {
    res.status(500).json({ error: 'Scan failed', details: String(err) });
  }
});

// Get git history for a specific logic file
router.get('/:projectId/history/:filePath(*)', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as
    | { id: string; path: string } | undefined;

  if (!project) return res.status(404).json({ error: 'Project not found' });

  const filePath = req.params.filePath;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);

  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: project.path, stdio: 'pipe' });
  } catch {
    return res.json({ commits: [], error: 'Not a git repository' });
  }

  try {
    const log = execSync(
      `git log -n ${limit} --pretty=format:"%H|%aI|%an|%s" -- "${filePath}"`,
      { cwd: project.path, encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024 }
    ).trim();

    if (!log) return res.json({ commits: [] });

    const commits = log.split('\n').map(line => {
      const [hash, date, author, ...msgParts] = line.split('|');
      return { hash, date, author, message: msgParts.join('|') };
    });

    res.json({ commits });
  } catch {
    res.json({ commits: [] });
  }
});

// Get diff for a specific file at a specific commit
router.get('/:projectId/diff/:hash/:filePath(*)', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as
    | { id: string; path: string } | undefined;

  if (!project) return res.status(404).json({ error: 'Project not found' });

  try {
    const diff = execSync(
      `git show ${req.params.hash} -- "${req.params.filePath}"`,
      { cwd: project.path, encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 }
    ).trim();

    // Also get the file content at that commit
    let contentAtCommit = '';
    try {
      contentAtCommit = execSync(
        `git show ${req.params.hash}:"${req.params.filePath}"`,
        { cwd: project.path, encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024 }
      );
    } catch {
      // File may not exist at that commit
    }

    res.json({ diff, content_at_commit: contentAtCommit });
  } catch {
    res.json({ diff: '', content_at_commit: '' });
  }
});

// Compare a logic file between two points in time
router.get('/:projectId/compare/:filePath(*)', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as
    | { id: string; path: string } | undefined;

  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { from, to } = req.query;
  if (!from) return res.status(400).json({ error: 'from commit hash required' });

  const toRef = (to as string) || 'HEAD';

  try {
    const diff = execSync(
      `git diff ${from}..${toRef} -- "${req.params.filePath}"`,
      { cwd: project.path, encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 }
    ).trim();

    res.json({ diff, from, to: toRef });
  } catch (err) {
    res.status(500).json({ error: 'Diff failed', details: String(err) });
  }
});

function getClaudeCodeData(projectPath: string) {
  const homeDir = os.homedir();

  // Memory files
  const claudeProjectsDir = path.join(homeDir, '.claude', 'projects');
  const normalizedProject = projectPath.replace(/^\//, '').replace(/\//g, '-');
  let memoryFiles: { name: string; content: string; frontmatter: Record<string, string> | null }[] = [];
  let memoryIndex: string | null = null;

  try {
    const dirs = fs.readdirSync(claudeProjectsDir);
    for (const dir of dirs) {
      if (dir !== normalizedProject) continue;
      const memDir = path.join(claudeProjectsDir, dir, 'memory');
      try {
        for (const f of fs.readdirSync(memDir)) {
          if (!f.endsWith('.md')) continue;
          const content = fs.readFileSync(path.join(memDir, f), 'utf-8');

          if (f === 'MEMORY.md') {
            memoryIndex = content;
            continue;
          }

          // Parse frontmatter
          let frontmatter: Record<string, string> | null = null;
          let body = content;
          const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
          if (fmMatch) {
            frontmatter = {};
            for (const line of fmMatch[1].split('\n')) {
              const kv = line.match(/^(\w+):\s*(.+)$/);
              if (kv) frontmatter[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
            }
            body = fmMatch[2];
          }

          memoryFiles.push({ name: f, content: body, frontmatter });
        }
      } catch { /* no memory dir */ }
    }
  } catch { /* no projects dir */ }

  // Global CLAUDE.md
  let globalClaudeMd: string | null = null;
  try {
    globalClaudeMd = fs.readFileSync(path.join(homeDir, '.claude', 'CLAUDE.md'), 'utf-8');
  } catch { /* doesn't exist */ }

  // Global settings
  let globalSettings: object | null = null;
  try {
    globalSettings = JSON.parse(fs.readFileSync(path.join(homeDir, '.claude', 'settings.json'), 'utf-8'));
  } catch { /* doesn't exist */ }

  return {
    memory_index: memoryIndex,
    memory_files: memoryFiles,
    global_claude_md: globalClaudeMd,
    global_settings: globalSettings,
  };
}

export default router;
