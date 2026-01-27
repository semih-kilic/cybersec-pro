# 🐉 CyberSec Pro - System Architecture

## Overview

CyberSec Pro is a cloud-based cybersecurity platform providing 165+ Kali Linux tools through a web interface.

```
┌─────────────────────────────────────────────────────────────────┐
│                     USERS (Browser)                             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE (DNS/CDN)                         │
│                  cybersecpro.com / semihkilic.com               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NGINX (Reverse Proxy)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   /        │  │  /api/v1/   │  │   /app/     │             │
│  │  Frontend  │  │  Backend    │  │  Dashboard  │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  SAAS-BACKEND   │ │  SALES-BACKEND  │ │  KALI-BACKEND   │
│  (Flask:5001)   │ │  (Flask:5002)   │ │  (Flask:5003)   │
│  - Auth/JWT     │ │  - Stripe       │ │  - Tool Exec    │
│  - Users        │ │  - Payments     │ │  - SSH/WS       │
│  - Orgs         │ │  - Webhooks     │ │  - Sessions     │
└────────┬────────┘ └─────────────────┘ └────────┬────────┘
         │                                        │
         ▼                                        ▼
┌─────────────────┐                    ┌─────────────────────────┐
│   PostgreSQL    │                    │   DOCKER CONTAINER      │
│   (Database)    │                    │   (Kali Linux)          │
└─────────────────┘                    │   ┌─────────────────┐   │
                                       │   │  165+ Tools     │   │
                                       │   │  - nmap         │   │
                                       │   │  - sqlmap       │   │
                                       │   │  - metasploit   │   │
                                       │   │  - burpsuite    │   │
                                       │   │  - ...          │   │
                                       │   └─────────────────┘   │
                                       └─────────────────────────┘
```

## Service Architecture

### 1. Docker Containers

| Container | Purpose | Port | Auto-restart |
|-----------|---------|------|--------------|
| cybersec-saas | Main API | 5001 | always |
| cybersec-kali | Tool execution | 5003 | always |
| cybersec-db | PostgreSQL | 5432 | always |
| cybersec-redis | Session/Cache | 6379 | always |

### 2. User Connection Methods

Users can connect to tools via:

1. **Web Terminal (WebSocket)** - Browser-based terminal
2. **SSH Tunnel** - Direct SSH access (Pro plan)
3. **VPN (WireGuard)** - Full network access (Enterprise plan)
4. **API** - Programmatic tool execution

### 3. Authentication

- **Email/Password** - Standard registration
- **Google OAuth** - One-click Google login
- **GitHub OAuth** - One-click GitHub login
- **JWT Tokens** - Session management

## File Structure

```
/home/cybersec/cybersec-pro/
├── docker-compose.yml          # Main orchestration
├── .env                        # Environment variables
├── nginx/                      # Nginx configs
├── saas-backend/              # Main API
├── saas-frontend/             # React Dashboard
├── cybersec-kali/             # Kali container & tools
│   ├── Dockerfile
│   ├── tools/                 # Tool configs
│   └── backend/               # Tool execution API
└── scripts/                   # Deployment scripts
```

## Deployment

### Development
```bash
docker-compose up -d
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Monitoring

- **Health Checks**: Every 30 seconds
- **Auto-restart**: On failure
- **Logs**: Centralized via Docker
- **Alerts**: Email on service down
