/**
 * CyberSec Pro — AI WebSocket Bridge (Ollama)
 *
 * Proxies WebSocket connections to local Ollama HTTP API.
 * Clients connect via WS and send/receive JSON messages.
 *
 * Message format (client → server):
 *   { type: "chat", model: "llama3", prompt: "..." }
 *   { type: "ping" }
 *
 * Message format (server → client):
 *   { type: "token", text: "..." }          ← streaming token
 *   { type: "done" }                         ← generation complete
 *   { type: "error", message: "..." }
 *   { type: "pong" }
 */

'use strict';

const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.AI_BRIDGE_PORT || 8765;
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', ollama: OLLAMA_HOST }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[ai-bridge] client connected: ${ip}`);

  ws.on('message', async (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
      return;
    }

    if (msg.type === 'chat') {
      const model = msg.model || 'llama3';
      const prompt = msg.prompt || '';

      if (!prompt) {
        ws.send(JSON.stringify({ type: 'error', message: 'prompt is required' }));
        return;
      }

      const body = JSON.stringify({ model, prompt, stream: true });
      const url = new URL('/api/generate', OLLAMA_HOST);

      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const req2 = http.request(options, (res) => {
        res.setEncoding('utf8');
        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk;
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.response) {
                ws.send(JSON.stringify({ type: 'token', text: parsed.response }));
              }
              if (parsed.done) {
                ws.send(JSON.stringify({ type: 'done' }));
              }
            } catch {
              // skip malformed line
            }
          }
        });

        res.on('end', () => {
          if (buffer.trim()) {
            try {
              const parsed = JSON.parse(buffer);
              if (parsed.response) ws.send(JSON.stringify({ type: 'token', text: parsed.response }));
              if (parsed.done) ws.send(JSON.stringify({ type: 'done' }));
            } catch { /* ignore */ }
          }
        });
      });

      req2.on('error', (err) => {
        console.error(`[ai-bridge] ollama request error: ${err.message}`);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', message: `Ollama error: ${err.message}` }));
        }
      });

      req2.write(body);
      req2.end();
      return;
    }

    ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
  });

  ws.on('close', () => {
    console.log(`[ai-bridge] client disconnected: ${ip}`);
  });
});

server.listen(PORT, () => {
  console.log(`[ai-bridge] listening on ws://0.0.0.0:${PORT}`);
  console.log(`[ai-bridge] proxying to ${OLLAMA_HOST}`);
});

process.on('SIGTERM', () => {
  console.log('[ai-bridge] shutting down');
  server.close(() => process.exit(0));
});
