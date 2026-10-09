# Work Trail

Work Trail is a battery-efficient field employee shift tracking, voice work update, and automated reporting system designed for field operations teams.

## Repository Structure

```
├── apps/
│   ├── api/       # NestJS backend (PostgreSQL, PostGIS, BullMQ, Anthropic Claude, Playwright)
│   ├── web/       # Next.js 15 dashboard for operations and admins
│   └── mobile/    # Expo / React Native mobile app with background tracking
├── packages/
│   ├── types/     # Shared TypeScript schemas and interfaces
│   └── ui/        # Shared design system components
├── docs/          # Operational, pilot, and architectural documentation
└── infra/         # Database migrations, backup scripts, and infrastructure
```

## Getting Started

### Prerequisites
- Node.js 22+
- pnpm 11+
- Docker & Docker Compose (PostgreSQL 16 + PostGIS, Redis 7)

### Local Development

1. Start database and cache services:
   ```bash
   pnpm db:up
   ```
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Run migrations and seed data:
   ```bash
   pnpm --filter @worktrail/api db:migrate
   pnpm --filter @worktrail/api db:seed
   ```
4. Start development servers:
   ```bash
   pnpm dev
   ```

## Production & Operations

- **Production Guide & Runbook**: See [docs/production.md](file:///D:/Git%20hub%20project/Work%20Trail/docs/production.md) for hosting architecture, deployment steps, scaling, and secret management.
- **Backups & Restore Drills**: See [infra/backup/README.md](file:///D:/Git%20hub%20project/Work%20Trail/infra/backup/README.md) for details on encrypted off-site backups with `age` and restoration drills.
- **Pilot Playbook**: See `docs/pilot-playbook.md` for company onboarding and pilot execution guidelines.
