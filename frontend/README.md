# Frontend (Marketing Site)

This folder contains the Next.js marketing website for CyberSec Pro.

## Stack

- Next.js `16.1.7`
- React `19.2.3`
- TypeScript `5`
- next-intl for localization
- GSAP / Framer Motion / Three.js for interactive visuals

## Development

```bash
cd frontend
pnpm install
pnpm dev
```

Default local URL:

- `http://localhost:3000`

## Build and Run

```bash
cd frontend
pnpm build
pnpm start
```

## Notes

- This project is separate from the SaaS app in `saas-frontend`.
- Keep marketing content/docs changes isolated from app dashboard changes when possible.
- Align shared brand/legal messaging with root docs (`README.md`, `CLAUDE.md`).
