const { WebSocketServer } = require('ws');
const pty = require('node-pty');

const PORT = 7600;
const JCODE_PATH = '/usr/local/bin/jcode';

const wss = new WebSocketServer({ port: PORT });
console.log(`jcode WebSocket bridge on ws://127.0.0.1:${PORT}`);

wss.on('connection', (ws) => {
    console.log('Client connected');
    
    const ptyProcess = pty.spawn(JCODE_PATH, ['--quiet', '--repl'], {
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
    
    ptyProcess.onData((data) => {
        if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'output', data }));
        }
    });
    
    ptyProcess.onExit(({ exitCode, signal }) => {
        console.log('jcode exited, code:', exitCode, 'signal:', signal);
        if (ws.readyState === 1) {
            ws.send(JSON.stringify({ type: 'output', data: '\r\njcode session ended. Click disconnect and relaunch.\r\n' }));
        }
    });
    
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
                    ptyProcess.write(msg.data + '\r');
                    break;
            }
        } catch (e) {
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
