import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// List sessions (optionally filter by project)
router.get('/', (req, res) => {
  const db = getDb();
  const { project_id, status } = req.query;

  let query = `
    SELECT s.*,
      (SELECT COUNT(*) FROM events e WHERE e.session_id = s.id) as event_count,
      p.name as project_name, p.path as project_path
    FROM sessions s
    JOIN projects p ON p.id = s.project_id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (project_id) {
    query += ' AND s.project_id = ?';
    params.push(project_id);
  }
  if (status) {
    query += ' AND s.status = ?';
    params.push(status);
  }

  query += ' ORDER BY s.started_at DESC LIMIT 100';

  const sessions = db.prepare(query).all(...params);
  res.json(sessions);
});

// Get single session with events
router.get('/:id', (req, res) => {
  const db = getDb();
  const session = db.prepare(`
    SELECT s.*, p.name as project_name, p.path as project_path
    FROM sessions s
    JOIN projects p ON p.id = s.project_id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

// Get events for a session
router.get('/:id/events', (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit as string) || 200, 1000);
  const offset = parseInt(req.query.offset as string) || 0;

  const events = db.prepare(`
    SELECT * FROM events
    WHERE session_id = ?
    ORDER BY timestamp ASC
    LIMIT ? OFFSET ?
  `).all(req.params.id, limit, offset);

  const total = db.prepare('SELECT COUNT(*) as count FROM events WHERE session_id = ?').get(req.params.id) as { count: number };

  res.json({ events, total: total.count });
});

// End a session
router.post('/:id/end', (req, res) => {
  const db = getDb();
  db.prepare(`
    UPDATE sessions SET status = 'completed', ended_at = datetime('now')
    WHERE id = ? AND status = 'active'
  `).run(req.params.id);
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(req.params.id);
  res.json(session);
});

export default router;
