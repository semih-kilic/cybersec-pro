const { WebSocketServer } = require('ws');
const http = require('http');

const PORT = 7600;
const OLLAMA_URL = 'http://127.0.0.1:11434';
const MODEL = 'qwen2.5-coder:1.5b';

const wss = new WebSocketServer({ port: PORT });
console.log('AI Bridge on ws://127.0.0.1:' + PORT);
console.log('Model: ' + MODEL);

wss.on('connection', (ws) => {
    console.log('Client connected');
    
    const messages = [];
    
    ws.send(JSON.stringify({ 
        type: 'output', 
        data: 'Connected to local AI (' + MODEL + ')\r\nType your message and press Enter.\r\n\r\n> '
    }));

    ws.on('message', (raw) => {
        try {
            const msg = JSON.parse(raw.toString());
            
            if (msg.type === 'input') {
                const userMsg = msg.data.trim();
                if (!userMsg) return;
                
                messages.push({ role: 'user', content: userMsg });
                
                ws.send(JSON.stringify({ type: 'output', data: '\r\nThinking...\r\n' }));
                
                const body = JSON.stringify({
                    model: MODEL,
                    messages: messages,
                    stream: true
                });

                const req = http.request({
                    hostname: '127.0.0.1',
                    port: 11434,
                    path: '/api/chat',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(body)
                    }
                }, (res) => {
                    let assistantMsg = '';
                    
                    res.on('data', (chunk) => {
                        const lines = chunk.toString().split('\n').filter(l => l.trim());
                        for (const line of lines) {
                            try {
                                const json = JSON.parse(line);
                                if (json.message && json.message.content) {
                                    const token = json.message.content;
                                    assistantMsg += token;
                                    ws.send(JSON.stringify({ type: 'output', data: token }));
                                }
                                if (json.done) {
                                    messages.push({ role: 'assistant', content: assistantMsg });
                                    ws.send(JSON.stringify({ type: 'output', data: '\r\n\r\n> ' }));
                                }
                            } catch (e) {}
                        }
                    });
                    
                    res.on('error', (err) => {
                        ws.send(JSON.stringify({ type: 'output', data: '\r\nError: ' + err.message + '\r\n> ' }));
                    });
                });

                req.on('error', (err) => {
                    ws.send(JSON.stringify({ type: 'output', data: '\r\nConnection error: ' + err.message + '\r\n> ' }));
                });

                req.write(body);
                req.end();
            }
        } catch (e) {
            ws.send(JSON.stringify({ type: 'output', data: 'Parse error: ' + e.message + '\r\n> ' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
    });
});

console.log('Waiting for connections...');
