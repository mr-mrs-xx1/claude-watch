import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import path from 'path';
import { getDb } from '../db.js';
import { broadcast } from '../websocket.js';
import type { HookPayload, CWEvent } from '../../types.js';

const router = Router();

// Receive hook events from Claude Code
router.post('/', (req, res) => {
  const payload = req.body as HookPayload;
  const db = getDb();

  const sessionId = payload.session_id || 'unknown';
  const projectPath = payload.project_path || extractProjectPath(payload);
  const projectName = projectPath ? path.basename(projectPath) : 'unknown';

  // Ensure project exists
  let project = db.prepare('SELECT * FROM projects WHERE path = ?').get(projectPath) as { id: string } | undefined;
  if (!project && projectPath) {
    const projectId = uuid();
    db.prepare('INSERT OR IGNORE INTO projects (id, name, path) VALUES (?, ?, ?)').run(projectId, projectName, projectPath);
    project = db.prepare('SELECT * FROM projects WHERE path = ?').get(projectPath) as { id: string } | undefined;
  }

  const projectId = project?.id || 'unknown';

  // Update project activity
  if (project) {
    db.prepare("UPDATE projects SET last_active_at = datetime('now') WHERE id = ?").run(projectId);
  }

  // Ensure session exists
  let session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as { id: string } | undefined;
  if (!session) {
    db.prepare('INSERT INTO sessions (id, project_id, status) VALUES (?, ?, ?)').run(sessionId, projectId, 'active');
    session = { id: sessionId };

    broadcast({
      type: 'session_update',
      data: { action: 'started', session_id: sessionId, project_id: projectId },
    });
  }

  // Determine event type and extract data
  const eventType = mapEventType(payload.type);
  const toolName = payload.tool_name || null;
  const inputData = payload.tool_input ? JSON.stringify(payload.tool_input) : null;
  const outputData = payload.tool_output ? JSON.stringify(payload.tool_output) : payload.message ? JSON.stringify({ message: payload.message }) : null;
  const filePath = extractFilePath(payload);
  const diff = extractDiff(payload);

  // Insert event
  const result = db.prepare(`
    INSERT INTO events (session_id, project_id, type, tool_name, input_data, output_data, file_path, diff)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sessionId, projectId, eventType, toolName, inputData, outputData, filePath, diff);

  const event: CWEvent = {
    id: Number(result.lastInsertRowid),
    session_id: sessionId,
    project_id: projectId,
    timestamp: new Date().toISOString(),
    type: eventType as CWEvent['type'],
    tool_name: toolName,
    input_data: inputData,
    output_data: outputData,
    file_path: filePath,
    diff,
    duration_ms: null,
  };

  // Broadcast to dashboard
  broadcast({ type: 'event', data: event });

  res.json({ ok: true, event_id: event.id });
});

// Get recent events across all projects
router.get('/', (req, res) => {
  const db = getDb();
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
  const projectId = req.query.project_id as string;

  let query = `
    SELECT e.*, p.name as project_name
    FROM events e
    JOIN projects p ON p.id = e.project_id
  `;
  const params: unknown[] = [];

  if (projectId) {
    query += ' WHERE e.project_id = ?';
    params.push(projectId);
  }

  query += ' ORDER BY e.timestamp DESC LIMIT ?';
  params.push(limit);

  const events = db.prepare(query).all(...params);
  res.json(events);
});

// Get stats
router.get('/stats', (_req, res) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const stats = {
    total_projects: (db.prepare('SELECT COUNT(*) as c FROM projects').get() as { c: number }).c,
    active_sessions: (db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status = 'active'").get() as { c: number }).c,
    total_events_today: (db.prepare('SELECT COUNT(*) as c FROM events WHERE timestamp >= ?').get(today) as { c: number }).c,
    total_snapshots: (db.prepare('SELECT COUNT(*) as c FROM snapshots').get() as { c: number }).c,
  };

  res.json(stats);
});

function mapEventType(hookType: string): string {
  switch (hookType) {
    case 'PreToolUse': return 'tool_use';
    case 'PostToolUse': return 'tool_result';
    case 'Notification': return 'notification';
    case 'Stop': return 'session_end';
    default: return 'tool_use';
  }
}

function extractFilePath(payload: HookPayload): string | null {
  if (!payload.tool_input) return null;
  const input = payload.tool_input;
  return (input.file_path || input.path || input.filePath || null) as string | null;
}

function extractProjectPath(payload: HookPayload): string {
  // Try to extract project path from file paths in tool input
  if (payload.tool_input) {
    const fp = (payload.tool_input.file_path || payload.tool_input.path) as string | undefined;
    if (fp && fp.startsWith('/')) {
      // Guess project root: go up until we find a common project indicator depth
      const parts = fp.split('/');
      // Return first 4 segments as a reasonable project root guess
      return parts.slice(0, Math.min(parts.length, 5)).join('/');
    }
  }
  return process.cwd();
}

function extractDiff(payload: HookPayload): string | null {
  if (!payload.tool_input) return null;
  const input = payload.tool_input;
  // For Edit tool, construct a diff-like representation
  if (payload.tool_name === 'Edit' && input.old_string && input.new_string) {
    return `--- old\n+++ new\n-${String(input.old_string).split('\n').join('\n-')}\n+${String(input.new_string).split('\n').join('\n+')}`;
  }
  return null;
}

export default router;
