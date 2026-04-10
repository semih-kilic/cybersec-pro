# CyberSec Pro — Coding Rules & Conventions

Extracted from the actual codebase. Follow these patterns consistently.

---

## Rust Coding Patterns

### Module Structure
Every feature area has a dedicated module file. The handler module uses `mod.rs` to re-export all submodules:
```rust
// handlers/mod.rs
pub mod auth_handlers;
pub mod scan_handlers;
// ...
```

### AppState Pattern
All shared state is in `Arc<AppState>` passed via `State<Arc<AppState>>` extractor. Never use `lazy_static` globals for request-scoped state. Background tasks clone the Arc before `tokio::spawn`.

```rust
pub struct AppState {
    pub db: PgPool,
    pub jwt_secret: String,
    pub rate_limiter: RateLimiter,
    pub scan_output_tx: broadcast::Sender<String>,
    pub service_manager: Arc<ServiceManager>,
    pub site_monitor: Arc<SiteMonitor>,
}
```

### Handler Signature Pattern
All handlers return `impl IntoResponse`. Use `(StatusCode, Json(json!(...)))` tuples for error responses. Never use `unwrap()` in handler hot paths — use `unwrap_or_default()`, `unwrap_or_else`, or return an error response.

```rust
pub async fn my_handler(
    State(state): State<Arc<AppState>>,
    auth: AuthUser,
    Json(body): Json<MyRequest>,
) -> impl IntoResponse {
    // ...
    (StatusCode::BAD_REQUEST, Json(json!({"error": "message"}))).into_response()
}
```

### Error Response Format
All JSON errors use the key `"error"`:
```json
{"error": "Human-readable message"}
```
Success responses wrap data in a named key matching the resource, or return a flat object. Lists always include pagination metadata.

### Authentication Extractor
Use `AuthUser` (requires valid JWT) or `AdminUser` (requires admin/superadmin role) as handler parameters — they are Axum `FromRequestParts` extractors. Do NOT manually parse tokens in handlers.

```rust
// In handler:
auth: AuthUser          // any authenticated user
auth: AdminUser         // admin only — returns 403 if not admin
```

Token extraction order: `Authorization: Bearer <token>` header → `access_token_cookie` cookie.  
**Never add URL query parameter token support** — comment in code explicitly forbids it (tokens in URLs leak via logs and Referer headers).

### Rate Limiting
Call `state.rate_limiter.is_limited(key, limit, window)` at the start of every public (unauthenticated) endpoint. Use IP-prefixed keys:
```rust
let ip = headers.get("x-forwarded-for")
    .and_then(|v| v.to_str().ok())
    .unwrap_or("unknown");
if state.rate_limiter.is_limited(&format!("endpoint_name:{}", ip), 3, Duration::from_secs(60)) {
    return (StatusCode::TOO_MANY_REQUESTS, Json(json!({"error": "Too many attempts"}))).into_response();
}
```

### Database Queries
Use `sqlx::query_as` with named struct types that implement `FromRow`. Never build SQL strings with format macros — always use bind parameters (`$1`, `$2`). Transactions for operations that touch multiple tables.

```rust
let row: Option<MyStruct> = sqlx::query_as("SELECT * FROM table WHERE id = $1")
    .bind(&id)
    .fetch_optional(&state.db)
    .await
    .unwrap_or(None);
```

### Model Pattern
Two structs per domain entity:
1. `Entity` — derives `FromRow`, `Clone`, `Serialize`, `Deserialize` — maps directly to DB row
2. `EntityResponse` — derives `Serialize` — safe public representation (no secrets/hashes)
3. `impl Entity { pub fn to_response(&self) -> EntityResponse }` — conversion method

```rust
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User { ... }

#[derive(Debug, Serialize)]
pub struct UserResponse { ... }

impl User {
    pub fn to_response(&self) -> UserResponse { ... }
    pub fn is_admin(&self) -> bool { ... }
}
```

### Logging
Use `tracing::info!`, `tracing::error!`, `tracing::warn!` — never `println!` or `eprintln!` in production code. Background task startup uses `tracing::info!` with emoji prefix to match existing style:
```rust
tracing::info!("🛡️  Service Manager watchdog started");
```

### Scan Execution
Scans run as subprocesses via `tokio::process::Command`. Output is streamed via `broadcast::Sender<String>` to SSE clients. SSH-dispatched scans go through `execute_scan()` in `scan_engine/executor.rs`. Always set `ConnectTimeout=10` and `BatchMode=yes` for SSH.

---

## API Conventions

- Base path: `/api/v1/` (current), `/api/v2/` (tools), `/api/v3/` (scan engine)
- Auth endpoints: `/api/v1/auth/*`
- Resource endpoints: plural nouns — `/api/v1/scans`, `/api/v1/agents`, `/api/v1/tools`
- Health check: `GET /api/health` (no auth required)
- Pagination query params: `?page=1&per_page=20` (max per_page=100)
- All response bodies are JSON
- CORS is configured in `main.rs` — do not configure it a second time in Nginx

---

## Naming Conventions

- **Rust files**: `snake_case.rs`
- **Handler functions**: `verb_noun` — e.g., `list_scans`, `get_scan`, `create_agent`, `delete_agent`
- **Struct names**: `PascalCase` — match the domain noun exactly
- **Environment variables**: `SCREAMING_SNAKE_CASE`
- **Docker container names**: `cybersec-<service>` — e.g., `cybersec-api`, `cybersec-db`
- **Database columns**: `snake_case`, TEXT for UUIDs (not PostgreSQL UUID type), JSONB for structured metadata

---

## What NOT To Do (Anti-Patterns Found in Code)

1. **Do not use `unwrap()` on DB calls in handlers** — use `unwrap_or_default()` or propagate the error with a 500 response
2. **Do not add new stub handlers** — implement stubs fully or don't add the route
3. **Do not put secrets in code** — no hardcoded credentials, tokens, or API keys (the `GITHUB_CLIENT_ID` in stub_handlers.rs is a known tech debt)
4. **Do not use `CorsLayer::permissive()`** in production — only the scan engine uses it internally; the main backend has explicit origin allowlist
5. **Do not modify `SCHEMA_STATEMENTS` destructively** — adding columns is safe, dropping/renaming columns is not (no migration versioning exists)
6. **Do not add query-param token auth** — explicitly prohibited in `auth_middleware.rs`
7. **Do not use `std::process::Command` (blocking)** in async context — use `tokio::process::Command`
8. **Do not use sqlx `0.7` in rust-backend** — it uses `0.8`; don't regress

---

## Test Requirements

No test files found in the codebase. `rust-scan-engine/Cargo.toml` has `reqwest 0.11` as a dev-dependency, implying integration tests were planned. When adding tests:
- Integration tests go in `tests/` directory under each crate
- Use `sqlx::test` macro for DB tests
- Mock external HTTP calls (Stripe, GitHub OAuth) — never hit real endpoints in CI

---

## Git Commit Format

All existing commits follow auto-sync format: `🔄 Auto-sync: YYYY-MM-DD HH:MM:SS`

For manual commits, use conventional commit format:
```
type(scope): description

feat(auth): implement Google OAuth flow
fix(scan): handle SSH timeout in executor
chore(deps): upgrade sqlx from 0.7 to 0.8 in scan-engine
```
