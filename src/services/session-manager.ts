import { getDb } from '../server/db.js';
import { broadcast } from '../server/websocket.js';

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// Periodically check for stale sessions and mark them as completed
export function startSessionCleanup(intervalMs = 60_000) {
  const timer = setInterval(() => {
    cleanupStaleSessions();
  }, intervalMs);

  // Don't keep the process alive just for cleanup
  timer.unref();
  return timer;
}

function cleanupStaleSessions() {
  const db = getDb();
  const cutoff = new Date(Date.now() - SESSION_TIMEOUT_MS).toISOString();

  // Find active sessions whose last event is older than the timeout
  const staleSessions = db.prepare(`
    SELECT s.id, s.project_id FROM sessions s
    WHERE s.status = 'active'
    AND (
      SELECT MAX(e.timestamp) FROM events e WHERE e.session_id = s.id
    ) < ?
  `).all(cutoff) as { id: string; project_id: string }[];

  for (const session of staleSessions) {
    db.prepare(`
      UPDATE sessions SET status = 'completed', ended_at = datetime('now')
      WHERE id = ?
    `).run(session.id);

    // Generate a simple summary
    const eventCounts = db.prepare(`
      SELECT tool_name, COUNT(*) as count FROM events
      WHERE session_id = ? AND tool_name IS NOT NULL
      GROUP BY tool_name ORDER BY count DESC
    `).all(session.id) as { tool_name: string; count: number }[];

    const summary = eventCounts
      .map(e => `${e.tool_name}: ${e.count}`)
      .join(', ');

    if (summary) {
      db.prepare('UPDATE sessions SET summary = ? WHERE id = ?').run(summary, session.id);
    }

    broadcast({
      type: 'session_update',
      data: { action: 'completed', session_id: session.id, project_id: session.project_id, summary },
    });
  }
}
