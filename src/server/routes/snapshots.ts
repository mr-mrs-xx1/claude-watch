import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { execSync } from 'child_process';
import { getDb } from '../db.js';
import { broadcast } from '../websocket.js';

const router = Router();

// List snapshots for a project
router.get('/', (req, res) => {
  const db = getDb();
  const { project_id } = req.query;

  let query = `
    SELECT s.*, p.name as project_name, p.path as project_path
    FROM snapshots s
    JOIN projects p ON p.id = s.project_id
  `;
  const params: unknown[] = [];

  if (project_id) {
    query += ' WHERE s.project_id = ?';
    params.push(project_id);
  }

  query += ' ORDER BY s.created_at DESC';
  const snapshots = db.prepare(query).all(...params);
  res.json(snapshots);
});

// Create a snapshot
router.post('/', (req, res) => {
  const { project_id, name, description } = req.body;
  if (!project_id || !name) {
    return res.status(400).json({ error: 'project_id and name are required' });
  }

  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id) as { id: string; path: string } | undefined;
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const id = uuid();
  let gitRef: string | null = null;
  let fileCount = 0;

  try {
    // Check if it's a git repo
    execSync('git rev-parse --is-inside-work-tree', { cwd: project.path, stdio: 'pipe' });

    // Get current file count
    const files = execSync('git ls-files | wc -l', { cwd: project.path, encoding: 'utf-8' }).trim();
    fileCount = parseInt(files) || 0;

    // Create a stash-like snapshot: stage everything, create a tree, then a commit
    const tagName = `claude-watch/${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;

    // Use git stash create to capture current state without modifying anything
    let stashRef: string;
    try {
      stashRef = execSync('git stash create', { cwd: project.path, encoding: 'utf-8' }).trim();
    } catch {
      stashRef = '';
    }

    if (stashRef) {
      // There were uncommitted changes, tag the stash
      execSync(`git tag "${tagName}" ${stashRef}`, { cwd: project.path, stdio: 'pipe' });
      gitRef = tagName;
    } else {
      // Working directory is clean, tag HEAD
      execSync(`git tag "${tagName}"`, { cwd: project.path, stdio: 'pipe' });
      gitRef = tagName;
    }
  } catch {
    // Not a git repo or git error — snapshot without git ref
    gitRef = null;
  }

  // Get active session
  const activeSession = db.prepare(
    "SELECT id FROM sessions WHERE project_id = ? AND status = 'active' ORDER BY started_at DESC LIMIT 1"
  ).get(project_id) as { id: string } | undefined;

  db.prepare(`
    INSERT INTO snapshots (id, project_id, session_id, name, description, git_ref, file_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, project_id, activeSession?.id || null, name, description || null, gitRef, fileCount);

  const snapshot = db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id);

  broadcast({ type: 'snapshot', data: snapshot });

  res.status(201).json(snapshot);
});

// Restore a snapshot
router.post('/:id/restore', (req, res) => {
  const db = getDb();
  const snapshot = db.prepare(`
    SELECT s.*, p.path as project_path
    FROM snapshots s
    JOIN projects p ON p.id = s.project_id
    WHERE s.id = ?
  `).get(req.params.id) as { git_ref: string | null; project_path: string } | undefined;

  if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
  if (!snapshot.git_ref) return res.status(400).json({ error: 'Snapshot has no git reference — cannot restore' });

  try {
    // First create a safety snapshot of current state
    try {
      const safetyTag = `claude-watch/pre-restore-${Date.now()}`;
      const stashRef = execSync('git stash create', { cwd: snapshot.project_path, encoding: 'utf-8' }).trim();
      if (stashRef) {
        execSync(`git tag "${safetyTag}" ${stashRef}`, { cwd: snapshot.project_path, stdio: 'pipe' });
      } else {
        execSync(`git tag "${safetyTag}"`, { cwd: snapshot.project_path, stdio: 'pipe' });
      }
    } catch {
      // Best effort safety snapshot
    }

    // Restore the snapshot
    execSync(`git checkout "${snapshot.git_ref}" -- .`, { cwd: snapshot.project_path, stdio: 'pipe' });

    res.json({ ok: true, message: 'Snapshot restored successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore snapshot', details: String(err) });
  }
});

// Compare two snapshots
router.get('/compare', (req, res) => {
  const { from, to } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to snapshot IDs are required' });

  const db = getDb();
  const fromSnap = db.prepare(`
    SELECT s.*, p.path as project_path FROM snapshots s JOIN projects p ON p.id = s.project_id WHERE s.id = ?
  `).get(from) as { git_ref: string | null; project_path: string } | undefined;
  const toSnap = db.prepare(`
    SELECT s.*, p.path as project_path FROM snapshots s JOIN projects p ON p.id = s.project_id WHERE s.id = ?
  `).get(to) as { git_ref: string | null; project_path: string } | undefined;

  if (!fromSnap || !toSnap) return res.status(404).json({ error: 'Snapshot not found' });
  if (!fromSnap.git_ref || !toSnap.git_ref) return res.status(400).json({ error: 'Both snapshots must have git references' });

  try {
    const diff = execSync(
      `git diff "${fromSnap.git_ref}" "${toSnap.git_ref}"`,
      { cwd: fromSnap.project_path, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
    );
    res.json({ diff });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compare snapshots', details: String(err) });
  }
});

// Delete a snapshot
router.delete('/:id', (req, res) => {
  const db = getDb();
  const snapshot = db.prepare(`
    SELECT s.*, p.path as project_path FROM snapshots s JOIN projects p ON p.id = s.project_id WHERE s.id = ?
  `).get(req.params.id) as { id: string; git_ref: string | null; project_path: string } | undefined;

  if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });

  // Remove git tag if exists
  if (snapshot.git_ref) {
    try {
      execSync(`git tag -d "${snapshot.git_ref}"`, { cwd: snapshot.project_path, stdio: 'pipe' });
    } catch {
      // Tag may not exist
    }
  }

  db.prepare('DELETE FROM snapshots WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
