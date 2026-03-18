import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface LogicFile {
  path: string;
  relativePath: string;
  name: string;
  category: 'prompt' | 'rules' | 'config' | 'docs' | 'state';
  content: string;
  size: number;
  lastModified: string;
  signals: string[];  // why we classified it this way
}

export interface LogicFileChange {
  relativePath: string;
  hash: string;
  date: string;
  author: string;
  message: string;
  diff: string;
}

export interface BrainScan {
  project_path: string;
  scanned_at: string;
  files: LogicFile[];
  recent_changes: LogicFileChange[];
  structure: DirectoryNode;
}

export interface DirectoryNode {
  name: string;
  type: 'dir' | 'file';
  children?: DirectoryNode[];
  fileCount?: number;
}

// --- File discovery patterns ---

const PROMPT_PATTERNS = [
  /prompt/i, /system.?prompt/i, /instructions/i,
  /\.cursorrules$/i, /copilot.?instructions/i,
];

const RULES_PATTERNS = [
  /voice.?guide/i, /style.?guide/i, /writing.?guide/i,
  /rules/i, /guidelines/i, /playbook/i,
  /CLAUDE\.md$/,
];

const CONFIG_PATTERNS = [
  /config\.(json|ya?ml|toml)$/i,
  /\.env\.example$/,
  /agent.?config/i,
  /settings\.(json|ya?ml)$/i,
];

const DOCS_PATTERNS = [
  /changelog/i, /learnings/i, /skills/i,
  /roadmap/i, /growth.?plan/i, /performance/i,
  /deep.?dive/i, /architecture/i, /infra/i,
  /enhancement/i,
];

const STATE_PATTERNS = [
  /stats\.json$/i, /metrics\.json$/i,
  /last_post\.json$/i, /posted\.json$/i,
  /history\.json$/i, /calendar/i,
];

// Directories that commonly hold logic/config files
const INTERESTING_DIRS = new Set([
  'config', 'docs', 'templates', '.claude', '.github', '.cursor',
]);

// Directories to always skip
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '__pycache__', '.venv',
  'venv', '.next', '.cache', 'coverage', '.tox', 'egg-info',
  'vendor', 'target', 'out', '.turbo',
]);

// Content signals that indicate a file contains logic/rules
const CONTENT_SIGNALS: [RegExp, string][] = [
  [/\bNEVER\b/g, 'contains NEVER rules'],
  [/\bALWAYS\b/g, 'contains ALWAYS rules'],
  [/\bMUST\b/g, 'contains MUST rules'],
  [/\bPRIORITY\s*#?\d/gi, 'has priority rules'],
  [/\brule\b/gi, 'mentions rules'],
  [/\bsafety\b/gi, 'has safety constraints'],
  [/\bbanned\b/gi, 'has banned items'],
  [/\bchecklist\b/gi, 'has checklist'],
  [/^\s*[-*]\s+(DO NOT|NEVER|ALWAYS|MUST)/gm, 'has instruction list items'],
  [/\bsystem\s*prompt\b/gi, 'references system prompt'],
  [/\bvoice\b/gi, 'defines voice/tone'],
  [/\btone\b/gi, 'defines voice/tone'],
  [/\bpersona\b/gi, 'defines persona'],
  [/\bengagement\b/gi, 'tracks engagement metrics'],
  [/\boptimiz/gi, 'involves optimization'],
  [/\bself[- ](?:modify|improv|evolv)/gi, 'self-modifying system'],
];

function classifyFile(relativePath: string, content: string): { category: LogicFile['category']; signals: string[] } | null {
  const signals: string[] = [];

  // Check filename patterns
  for (const p of PROMPT_PATTERNS) {
    if (p.test(relativePath)) { signals.push('filename matches prompt pattern'); break; }
  }
  for (const p of RULES_PATTERNS) {
    if (p.test(relativePath)) { signals.push('filename matches rules/guide pattern'); break; }
  }
  for (const p of CONFIG_PATTERNS) {
    if (p.test(relativePath)) { signals.push('filename matches config pattern'); break; }
  }
  for (const p of DOCS_PATTERNS) {
    if (p.test(relativePath)) { signals.push('filename matches docs pattern'); break; }
  }
  for (const p of STATE_PATTERNS) {
    if (p.test(relativePath)) { signals.push('filename matches state/data pattern'); break; }
  }

  // Check directory
  const dir = path.dirname(relativePath).split('/')[0];
  if (INTERESTING_DIRS.has(dir)) {
    signals.push(`in ${dir}/ directory`);
  }

  // Check content signals (only for text files)
  if (content && !relativePath.endsWith('.json')) {
    let contentScore = 0;
    for (const [regex, desc] of CONTENT_SIGNALS) {
      regex.lastIndex = 0;
      const matches = content.match(regex);
      if (matches && matches.length >= 2) {
        signals.push(desc);
        contentScore += matches.length;
      }
    }
    // If file has many rule-like patterns but wasn't caught by name, include it
    if (contentScore >= 5 && signals.length === 0) {
      signals.push(`high instruction density (${contentScore} signals)`);
    }
  }

  if (signals.length === 0) return null;

  // Determine category
  let category: LogicFile['category'] = 'docs';
  const rp = relativePath.toLowerCase();
  if (PROMPT_PATTERNS.some(p => p.test(rp))) category = 'prompt';
  else if (RULES_PATTERNS.some(p => p.test(rp))) category = 'rules';
  else if (CONFIG_PATTERNS.some(p => p.test(rp))) category = 'config';
  else if (STATE_PATTERNS.some(p => p.test(rp))) category = 'state';
  else if (signals.some(s => s.includes('instruction') || s.includes('NEVER') || s.includes('ALWAYS') || s.includes('MUST') || s.includes('priority') || s.includes('safety'))) category = 'rules';
  else if (signals.some(s => s.includes('prompt') || s.includes('persona') || s.includes('voice'))) category = 'prompt';
  else if (signals.some(s => s.includes('config'))) category = 'config';
  else if (signals.some(s => s.includes('state') || s.includes('metrics'))) category = 'state';

  return { category, signals };
}

export function scanProjectBrain(projectPath: string): BrainScan {
  const files: LogicFile[] = [];
  const maxFileSize = 100 * 1024; // 100KB max per file

  function walk(dir: string, depth: number) {
    if (depth > 4) return; // don't go too deep
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch { return; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(projectPath, fullPath);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        // Always scan interesting dirs; scan others only at shallow depth
        if (INTERESTING_DIRS.has(entry.name) || depth < 3) {
          walk(fullPath, depth + 1);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      // Only consider text/config files — never code
      const ext = path.extname(entry.name).toLowerCase();
      const codeExts = new Set(['.py', '.js', '.ts', '.jsx', '.tsx', '.go', '.rs', '.java', '.rb', '.sh', '.c', '.cpp', '.h']);
      if (codeExts.has(ext)) continue;

      const textExts = new Set(['.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.conf', '.cfg', '.ini', '.env']);
      const isInterestingName = /^(CLAUDE|README|SYSTEM|PROMPT|RULES|CONFIG|PLAYBOOK)/i.test(entry.name) ||
        entry.name.startsWith('.cursorrules') || entry.name.startsWith('.env');
      if (!textExts.has(ext) && !isInterestingName) continue;

      // Read file
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size > maxFileSize) continue;
        if (stat.size === 0) continue;

        const content = fs.readFileSync(fullPath, 'utf-8');

        const result = classifyFile(relativePath, content);
        if (!result) continue;

        files.push({
          path: fullPath,
          relativePath,
          name: entry.name,
          category: result.category,
          content,
          size: stat.size,
          lastModified: stat.mtime.toISOString(),
          signals: result.signals,
        });
      } catch {
        continue;
      }
    }
  }

  walk(projectPath, 0);

  // Sort: prompts first, then rules, then config, then docs, then state
  const order: Record<string, number> = { prompt: 0, rules: 1, config: 2, docs: 3, state: 4 };
  files.sort((a, b) => (order[a.category] ?? 99) - (order[b.category] ?? 99));

  // Get recent changes to logic files via git
  const recentChanges = getRecentLogicChanges(projectPath, files);

  // Get project structure
  const structure = getProjectStructure(projectPath);

  return {
    project_path: projectPath,
    scanned_at: new Date().toISOString(),
    files,
    recent_changes: recentChanges,
    structure,
  };
}

function getRecentLogicChanges(projectPath: string, files: LogicFile[]): LogicFileChange[] {
  if (files.length === 0) return [];

  try {
    // Check if git repo
    execSync('git rev-parse --is-inside-work-tree', { cwd: projectPath, stdio: 'pipe' });
  } catch {
    return [];
  }

  const changes: LogicFileChange[] = [];
  const filePaths = files.map(f => f.relativePath);

  try {
    // Get recent commits that touched any logic file
    const logOutput = execSync(
      `git log --oneline -n 50 --pretty=format:"%H|%aI|%an|%s" -- ${filePaths.map(f => `"${f}"`).join(' ')}`,
      { cwd: projectPath, encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 }
    ).trim();

    if (!logOutput) return [];

    for (const line of logOutput.split('\n').slice(0, 30)) {
      const [hash, date, author, ...msgParts] = line.split('|');
      if (!hash) continue;
      const message = msgParts.join('|');

      // Get diff for this commit on logic files only
      try {
        const diff = execSync(
          `git show ${hash} --format="" -- ${filePaths.map(f => `"${f}"`).join(' ')}`,
          { cwd: projectPath, encoding: 'utf-8', maxBuffer: 2 * 1024 * 1024 }
        ).trim();

        if (!diff) continue;

        // Extract which files changed
        const changedFiles = diff.match(/^diff --git a\/(.*?) b\//gm)
          ?.map(m => m.replace('diff --git a/', '').replace(/ b\/.*/, ''))
          || [];

        for (const cf of changedFiles) {
          const fileDiffRegex = new RegExp(`diff --git a/${cf.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} b/.*?(?=diff --git|$)`, 's');
          const fileDiff = diff.match(fileDiffRegex)?.[0] || '';

          changes.push({
            relativePath: cf,
            hash: hash.slice(0, 8),
            date,
            author,
            message,
            diff: fileDiff.slice(0, 5000), // limit diff size
          });
        }
      } catch {
        continue;
      }
    }
  } catch {
    // Git command failed
  }

  return changes;
}

function getProjectStructure(projectPath: string, maxDepth = 2): DirectoryNode {
  function buildTree(dir: string, depth: number): DirectoryNode {
    const name = path.basename(dir);
    const node: DirectoryNode = { name, type: 'dir', children: [] };

    if (depth > maxDepth) return node;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      let fileCount = 0;

      for (const entry of entries) {
        if (entry.name.startsWith('.') && entry.name !== '.claude') continue;
        if (SKIP_DIRS.has(entry.name)) continue;

        if (entry.isDirectory()) {
          node.children!.push(buildTree(path.join(dir, entry.name), depth + 1));
        } else {
          fileCount++;
        }
      }

      if (fileCount > 0) {
        node.fileCount = fileCount;
      }

      // Sort: dirs first, then by name
      node.children!.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
    } catch {
      // Can't read dir
    }

    return node;
  }

  return buildTree(projectPath, 0);
}
