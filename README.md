# MaintainPro

Multi-tenant industrial maintenance management SaaS — breakdown management, spare parts, autonomous maintenance (TPM Pillar 1), preventive maintenance, and role-based dashboards.

Built for Turkish manufacturing plants of 50–500 people. UI is Turkish; code is English. See [CLAUDE.md](CLAUDE.md) and [MaintainPro_MVP_Spesifikasyon_v2.docx](MaintainPro_MVP_Spesifikasyon_v2.docx) for the full spec.

## Stack

Next.js 14 (App Router) · TypeScript · Tailwind · shadcn/ui · Prisma 6 · PostgreSQL 16 · NextAuth v5 · Zustand · TanStack Query · Zod · Vitest.

## First-run (local dev)

Requirements: Node 20+, Docker (for local Postgres), npm.

```bash
# 1. Install dependencies
npm install

# 2. Copy env file
cp .env.example .env
# Generate a secret: openssl rand -base64 32 → paste as NEXTAUTH_SECRET

# 3. Start Postgres (Docker)
docker compose up -d

# 4. Apply schema + RLS policies + seed data
npm run db:migrate        # creates tables
npm run db:rls            # applies prisma/rls.sql (requires psql on PATH)
npm run db:seed           # seeds 2 factories + users + machines

# 5. Run dev server
npm run dev
```

Open http://localhost:3000 — you will be redirected to `/giris` (login).

### Seeded accounts (password for all: `Test1234!`)

| Email | Role |
| --- | --- |
| `super@maintainpro.local` | Super Admin (no factory) |
| `admin@acme-metal.local` | Factory Admin — Acme Metal |
| `muhendis@acme-metal.local` | Engineer — Acme Metal |
| `teknisyen@acme-metal.local` | Technician — Acme Metal |
| `admin@delta-plastik.local` | Factory Admin — Delta Plastik |
| `muhendis@delta-plastik.local` | Engineer — Delta Plastik |
| `teknisyen@delta-plastik.local` | Technician — Delta Plastik |

## Commands

```bash
npm run dev           # Next.js dev server (http://localhost:3000)
npm run build         # Production build
npm start             # Serve production build
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit

npm run db:generate   # Regenerate Prisma client after schema changes
npm run db:migrate    # Apply new migrations (prisma migrate dev)
npm run db:reset      # Drop + reseed (DESTRUCTIVE)
npm run db:seed       # Re-seed without migrating
npm run db:rls        # Apply RLS policies from prisma/rls.sql

npm run test          # Run Vitest suite once
npm run test:watch    # Vitest watch mode
```

Run a single test: `npx vitest run tests/tenant-isolation.test.ts`

## Architecture — the three things you must understand before editing

### 1. Multi-tenancy is enforced at TWO layers (spec §16)

Every domain table carries `factoryId`. Isolation is enforced by:

1. **Postgres RLS policies** (`prisma/rls.sql`) — `current_setting('app.factory_id')` must match the row's `factoryId`.
2. **Prisma transaction helpers** (`src/lib/tenant/prisma.ts`) — every query runs inside `withFactoryTx()` which sets the session variable before running the query body.

API route pattern:

```ts
import { withApiTenant } from "@/lib/auth/api-tenant";
import { withFactoryTx } from "@/lib/tenant/prisma";

export async function GET() {
  return withApiTenant({ roles: ["ENGINEER", "FACTORY_ADMIN"] }, async () => {
    const machines = await withFactoryTx((tx) => tx.machine.findMany());
    return { machines };
  });
}
```

**Never** use `unsafePrisma` from application code. **Never** read `factoryId` from request input — always from the session. The smoke test in `tests/tenant-isolation.test.ts` asserts this invariant.

### 2. Real-time is event-sourced from day one

Every write to a tenant-scoped entity should publish a `DomainEvent` (`src/lib/events/types.ts`). The `InMemoryBus` (`src/lib/events/in-memory.ts`) is the current transport — it works for one App Runner container. When scaling horizontally, swap in a Postgres LISTEN/NOTIFY bus; the `EventBus` interface stays the same.

Clients subscribe via SSE at `/api/events/stream`. The `useRealtimeInvalidation()` hook (mounted in `AppShell`) listens for events and invalidates TanStack Query keys — UIs refresh without polling.

### 3. Breakdown state machine (spec §4.2)

```
Açık → Atandı → Müdahale Ediliyor ⇄ Parça Bekleniyor → Çözüldü → Kapatıldı
```

Every transition writes a `BreakdownTimeline` row and must go through a service that emits a `breakdown.status_changed` event. Do not write raw status updates.

## Deployment (AWS)

Target: eu-central-1, AWS App Runner + RDS Postgres + S3 + SES. See [infra/README.md](infra/README.md) for the manual setup walkthrough. `Dockerfile` and `apprunner.yaml` are ready; CI via GitHub Actions comes in sprint 8.

## Current sprint

Sprint 1 — project skeleton + auth + DB. See spec §13 for the 8-sprint roadmap.
