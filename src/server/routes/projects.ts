import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db.js';
import type { Project } from '../../types.js';

const router = Router();

// List all projects
router.get('/', (_req, res) => {
  const db = getDb();
  const projects = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM sessions s WHERE s.project_id = p.id AND s.status = 'active') as active_sessions,
      (SELECT COUNT(*) FROM events e WHERE e.project_id = p.id) as total_events
    FROM projects p
    ORDER BY p.last_active_at DESC NULLS LAST
  `).all();
  res.json(projects);
});

// Get single project
router.get('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

// Register a project
router.post('/', (req, res) => {
  const { name, path: projectPath } = req.body;
  if (!name || !projectPath) return res.status(400).json({ error: 'name and path are required' });

  const db = getDb();
  const existing = db.prepare('SELECT * FROM projects WHERE path = ?').get(projectPath) as Project | undefined;
  if (existing) return res.json(existing);

  const id = uuid();
  db.prepare('INSERT INTO projects (id, name, path) VALUES (?, ?, ?)').run(id, name, projectPath);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  res.status(201).json(project);
});

// Delete a project
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM events WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM snapshots WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM sessions WHERE project_id = ?').run(req.params.id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
