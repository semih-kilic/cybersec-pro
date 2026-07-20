
const { WebSocketServer } = require('ws');
const pty = require('node-pty');

const PORT = 7600;
const JCODE_PATH = '/home/cybersec/cybersec-pro/jcode/target/release/jcode';

const wss = new WebSocketServer({ port: PORT });
console.log(`🔌 jcode WebSocket bridge on ws://127.0.0.1:${PORT}`);

wss.on('connection', (ws) => {
    console.log('Client connected');
    
    // Spawn jcode with PTY
    const ptyProcess = pty.spawn(JCODE_PATH, ['--no-config'], {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd: '/home/cybersec/cybersec-pro',
        env: {
            ...process.env,
            TERM: 'xterm-256color',
            HOME: '/root',
            PATH: `/root/.cargo/bin:${process.env.PATH}`
        }
    });
    
    console.log('jcode spawned, PID:', ptyProcess.pid);
    
    // Forward jcode output to WebSocket
    ptyProcess.onData((data) => {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'output', data }));
        }
    });
    
    // Forward WebSocket input to jcode
    ws.on('message', (message) => {
        try {
            const msg = JSON.parse(message.toString());
            switch (msg.type) {
                case 'input':
                    ptyProcess.write(msg.data);
                    break;
                case 'resize':
                    ptyProcess.resize(msg.cols || 120, msg.rows || 40);
                    break;
                case 'execute':
                    // Send command + Enter
                    ptyProcess.write(msg.data + '\r');
                    break;
            }
        } catch (e) {
            // Plain text input
            ptyProcess.write(message.toString());
        }
    });
    
    ws.on('close', () => {
        console.log('Client disconnected, killing jcode');
        ptyProcess.kill();
    });
    
    ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        ptyProcess.kill();
    });
});

console.log('Waiting for connections...');
