import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getDb } from '../db.js';

const router = Router();

interface FileResult {
  path: string;
  content: string;
}

interface JsonFileResult {
  path: string;
  content: object;
}

interface MemoryFile {
  path: string;
  name: string;
  content: string;
  frontmatter: object | null;
}

function readTextFile(filePath: string): FileResult | null {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { path: filePath, content };
  } catch {
    return null;
  }
}

function readJsonFile(filePath: string): JsonFileResult | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const content = JSON.parse(raw);
    return { path: filePath, content };
  } catch {
    return null;
  }
}

function parseFrontmatter(content: string): { frontmatter: object | null; content: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { frontmatter: null, content };

  try {
    // Simple YAML key-value parser for frontmatter
    const yamlBlock = match[1];
    const body = match[2];
    const frontmatter: Record<string, string | string[]> = {};

    let currentKey: string | null = null;
    let currentArray: string[] | null = null;

    for (const line of yamlBlock.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check for array item (starts with "- ")
      if (/^\s*-\s+/.test(line) && currentKey) {
        const value = line.replace(/^\s*-\s+/, '').trim();
        if (!currentArray) {
          currentArray = [];
        }
        currentArray.push(value);
        frontmatter[currentKey] = currentArray;
        continue;
      }

      // Save any pending array
      currentArray = null;

      const kvMatch = trimmed.match(/^(\w[\w\s]*?):\s*(.*)$/);
      if (kvMatch) {
        currentKey = kvMatch[1].trim();
        const value = kvMatch[2].trim();
        if (value) {
          // Strip surrounding quotes
          frontmatter[currentKey] = value.replace(/^["']|["']$/g, '');
        }
      }
    }

    return { frontmatter, content: body };
  } catch {
    return { frontmatter: null, content };
  }
}

function findNestedClaudeMd(projectPath: string, maxDepth: number = 3): FileResult[] {
  const results: FileResult[] = [];

  function scan(dir: string, depth: number) {
    if (depth > maxDepth) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        // Skip common non-project directories
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.claude') continue;

        const subDir = path.join(dir, entry.name);
        const claudePath = path.join(subDir, 'CLAUDE.md');
        const file = readTextFile(claudePath);
        if (file) results.push(file);

        if (depth < maxDepth) {
          scan(subDir, depth + 1);
        }
      }
    } catch {
      // Directory not readable, skip
    }
  }

  scan(projectPath, 1);
  return results;
}

function findMemoryFiles(projectPath: string): {
  index: FileResult | null;
  files: MemoryFile[];
} {
  const result: { index: FileResult | null; files: MemoryFile[] } = {
    index: null,
    files: [],
  };

  const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');

  let projectDirs: string[];
  try {
    projectDirs = fs.readdirSync(claudeProjectsDir);
  } catch {
    return result;
  }

  // Claude Code mangles paths by replacing path separators with dashes.
  // Normalize the project path for matching.
  const normalizedProject = projectPath.replace(/^\//, '').replace(/\//g, '-');

  for (const dirName of projectDirs) {
    // Check if this directory could match the project path
    if (dirName !== normalizedProject) continue;

    const memoryDir = path.join(claudeProjectsDir, dirName, 'memory');
    let memoryEntries: string[];
    try {
      memoryEntries = fs.readdirSync(memoryDir);
    } catch {
      continue;
    }

    for (const entry of memoryEntries) {
      if (!entry.endsWith('.md')) continue;

      const filePath = path.join(memoryDir, entry);
      const raw = readTextFile(filePath);
      if (!raw) continue;

      const { frontmatter, content } = parseFrontmatter(raw.content);

      if (entry === 'MEMORY.md') {
        result.index = { path: filePath, content };
      }

      result.files.push({
        path: filePath,
        name: entry,
        content,
        frontmatter,
      });
    }
  }

  return result;
}

// Get project instructions / Claude Code configuration
router.get('/:projectId', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.projectId) as
    | { id: string; name: string; path: string }
    | undefined;

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const projectPath = project.path;
  const homeDir = os.homedir();

  // Project-level files
  const rootClaudeMd = readTextFile(path.join(projectPath, 'CLAUDE.md'));
  const nestedClaudeMd = findNestedClaudeMd(projectPath);
  const settings = readJsonFile(path.join(projectPath, '.claude', 'settings.json'));
  const localSettings = readJsonFile(path.join(projectPath, '.claude', 'settings.local.json'));

  // Global/user-level files
  const globalClaudeMd = readTextFile(path.join(homeDir, '.claude', 'CLAUDE.md'));
  const globalSettings = readJsonFile(path.join(homeDir, '.claude', 'settings.json'));

  // Memory files
  const memory = findMemoryFiles(projectPath);

  res.json({
    project_instructions: {
      root_claude_md: rootClaudeMd,
      nested_claude_md: nestedClaudeMd,
      settings,
      local_settings: localSettings,
    },
    global_instructions: {
      claude_md: globalClaudeMd,
      settings: globalSettings,
    },
    memory,
  });
});

export default router;
