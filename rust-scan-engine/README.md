# CyberSec Pro — Rust Scan Engine

High-performance, secure scan execution microservice built with Rust + Axum.

## Why Rust?

| Feature | Python (current) | Rust (this engine) |
|---------|------------------|--------------------|
| Command execution | `shell=True` risk | No shell, arg vectors only |
| Concurrency | GIL-limited threads | Tokio async, zero-cost |
| Memory safety | Manual management | Guaranteed at compile time |
| Speed | Interpreted | Native binary, ~50x faster |
| Type safety | Runtime errors | Compile-time guarantees |

## Architecture

```
Flask Backend (app.py)  ──HTTP──►  Rust Scan Engine (:5002)
                                      │
                                      ├── /api/v3/scan          POST  Start scan
                                      ├── /api/v3/scan/:id/status  GET   Status
                                      ├── /api/v3/scan/:id/output  GET   Output
                                      └── /api/v3/scan/:id/cancel  POST  Cancel
```

## Security Features

- **Tool whitelist**: Only 50+ explicitly allowed tools can execute
- **No shell**: Commands built as argument vectors, never `shell=true`
- **Argument sanitization**: Blocked patterns (`;`, `&&`, `` ` ``, `$(`, etc.)
- **Worker pool**: Semaphore-limited concurrent scans (default: 8)
- **Timeout enforcement**: Per-scan timeout with automatic process kill
- **kill_on_drop**: If task is cancelled, child process is immediately killed
- **Output cap**: Max 10,000 lines per scan to prevent memory exhaustion
- **JWT auth**: Same secret as Flask backend, validates Bearer tokens

## Setup

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Build
cd rust-scan-engine
cargo build --release

# Run
SCAN_ENGINE_PORT=5002 JWT_SECRET_KEY=<your-key> cargo run --release
```

## Integration

In `app.py`, route scan execution to the Rust engine:

```python
import requests

SCAN_ENGINE_URL = os.environ.get('SCAN_ENGINE_URL', 'http://localhost:5002')

def execute_scan_v3(tool, target, params=None, profile='standard', timeout=300):
    resp = requests.post(f'{SCAN_ENGINE_URL}/api/v3/scan', json={
        'tool': tool,
        'target': target,
        'params': params,
        'profile': profile,
        'timeout': timeout,
    }, headers={'Authorization': f'Bearer {get_internal_token()}'})
    return resp.json()
```

## Migration Plan

1. **Phase 1** (Done): Scaffold project with Axum + Tokio
2. **Phase 2**: Install Rust, compile, test with unit tests
3. **Phase 3**: Run alongside Flask, dual-write scan requests
4. **Phase 4**: Gradually migrate scan execution to Rust engine
5. **Phase 5**: Remove Python scan execution code
