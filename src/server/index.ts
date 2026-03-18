import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { getDb } from './db.js';
import { initWebSocket } from './websocket.js';
import eventsRouter from './routes/events.js';
import sessionsRouter from './routes/sessions.js';
import projectsRouter from './routes/projects.js';
import snapshotsRouter from './routes/snapshots.js';
import instructionsRouter from './routes/instructions.js';
import brainRouter from './routes/brain.js';
import searchRouter from './routes/search.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface ServerOptions {
  port: number;
  dev?: boolean;
}

export function createApp(options: ServerOptions) {
  const app = express();
  const server = createServer(app);

  // Initialize database
  getDb();

  // Initialize WebSocket
  initWebSocket(server);

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // API routes
  app.use('/api/events', eventsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/projects', projectsRouter);
  app.use('/api/snapshots', snapshotsRouter);
  app.use('/api/instructions', instructionsRouter);
  app.use('/api/brain', brainRouter);
  app.use('/api/search', searchRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0', uptime: process.uptime() });
  });

  // Serve dashboard static files
  if (!options.dev) {
    const dashboardPath = path.resolve(__dirname, '..', 'dashboard', 'dist');
    app.use(express.static(dashboardPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(dashboardPath, 'index.html'));
    });
  }

  return { app, server };
}

export function startServer(options: ServerOptions): Promise<void> {
  return new Promise((resolve) => {
    const { server } = createApp(options);
    server.listen(options.port, () => {
      resolve();
    });
  });
}
