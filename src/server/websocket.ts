import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { WebSocketMessage } from '../types.js';

let wss: WebSocketServer;

export function initWebSocket(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'connected', data: { timestamp: new Date().toISOString() } }));
  });

  return wss;
}

export function broadcast(message: WebSocketMessage) {
  if (!wss) return;

  const data = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}
