# CLAUDE.md

> **Versiyon:** 1.0.0  
> **Son güncelleme:** 2026-04-13

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Changelog

| Versiyon | Tarih | Değişiklik |
|----------|-------|------------|
| 1.0.0 | 2026-04-13 | MVP tamamlandı — Sprint 1-8 (Auth, Makine, Arıza, Yedek Parça, Otonom Bakım, Bildirim+PWA, Dashboard, Super Admin+Docker). Tüm modüller build-clean. |

## Repository status

This repository is a **complete MVP**. All 8 sprints are implemented and the production build passes cleanly.

- [MaintainPro_MVP_Spesifikasyon_v2.docx](MaintainPro_MVP_Spesifikasyon_v2.docx) — MaintainPro MVP technical spec, April 2026.
- [docs/INDEX.md](docs/INDEX.md) — Full module-by-module usage guide and reference documentation.

Tables carry most of the substance (data fields, state machines, permission matrix, notification rules, AWS cost sheet) — iterate `w:tbl` elements, not just paragraphs.

## Product in one paragraph

MaintainPro is a multi-tenant SaaS CMMS for manufacturing plants: breakdown management, spare-parts stock, autonomous maintenance (TPM Pillar 1 / Jishu Hozen), preventive maintenance, and role-based dashboards. One shared Postgres database serves many factories, isolated by `factory_id` + Row Level Security. Target user is a Turkish manufacturing plant of 50–500 people; the UI and domain vocabulary are Turkish.

## Planned stack (spec §11)

- **Frontend:** Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Radix
- **State:** Zustand (client) + TanStack Query (server cache)
- **Backend:** Next.js API Routes (full-stack monorepo, no separate backend)
- **ORM / DB:** Prisma → PostgreSQL on AWS RDS
- **Auth:** NextAuth.js for MVP → migrate to AWS Cognito in v2
- **Files:** S3 presigned URLs (photos, technical docs); image metadata in `photos` table
- **Realtime / push:** FCM for push, Socket.io or Supabase Realtime for in-app
- **Email:** AWS SES
- **Hosting:** AWS App Runner (MVP) → ECS Fargate (growth); CI via GitHub Actions → ECR
- **Validation:** Zod on every API boundary
- **Charts:** Recharts; PDF via jsPDF + autoTable; QR via `qrcode` + `html5-qrcode`

Do not substitute a different stack without asking. The sprint plan, prompt sequence, and AWS cost model all assume this one.

## Architecture that cuts across files

### Multi-tenancy is non-negotiable

Every domain table carries `factory_id`. Tenant isolation is enforced at **two** layers and both must be in place — spec §16 explicitly requires this:

1. **Postgres RLS policies** on every tenant-scoped table.
2. **Prisma middleware** that injects `factory_id` from the authenticated session into every query and mutation.

Never write a raw query or a Prisma call that bypasses the middleware, and never read `factory_id` from request input — always from the server-side session. A cross-tenant leak is the single worst bug this system can have.

### Role model (spec §2)

Four roles with a fixed permission matrix: `SUPER_ADMIN`, `FACTORY_ADMIN`, `ENGINEER`, `TECHNICIAN`. Super Admin is platform-level and lives outside any `factory_id`; the other three are scoped to a factory. When adding an endpoint, cross-reference §2.2 before picking who can call it — the matrix is prescriptive, not suggestive.

### Breakdown state machine (spec §4.2)

Breakdowns are the core workflow and have a strict state machine:

```
Açık → Atandı → Müdahale Ediliyor ⇄ Parça Bekleniyor → Çözüldü → Kapatıldı
                                                       ↑         ↓
                                                       └── Reddet (yetersiz)
```

Each transition has an allowed role, a side effect (timestamp, notification, timeline row), and an escalation rule (§9.3). Model transitions explicitly — do not allow ad-hoc status writes. Every transition writes a row to `breakdown_timeline`.

### Data model anchor tables (spec §11.2)

Keep these relationships in mind because they drive most queries:

- `factories` is the tenant root → owns `users`, `departments`, `machines`, `spare_parts`, `subscriptions`.
- `machines` is the asset anchor → `breakdowns`, `checklist_templates`, `pm_plans`, `stock_movements` all reference it.
- `breakdowns` ↔ `breakdown_timeline` ↔ `stock_movements` (parts consumed) ↔ `photos`.
- `checklist_templates` → `checklist_items` → `checklist_records` → `item_responses` → auto-spawned `actions`.
- `photos` stores S3 keys + `(reference_type, reference_id)` polymorphic link — one table backs machine photos, breakdown photos, checklist photos, action before/after shots.

When an autonomous-maintenance checklist item is marked "abnormal," the system **automatically** opens an `actions` row — this is not a UI thing, it's a server-side side effect of saving the response (§6.2 step 4).

### Notifications and escalation (spec §9)

Notifications fan out across four channels (FCM push, SES email, in-app websocket, optional Twilio SMS). User preferences gate them per-channel, per-event-type, with quiet hours and department filters. Escalation is time-based: unanswered breakdown → engineer at 30 min → factory admin at 60 min → super admin at 2 h for critical. Implement escalation as scheduled jobs, not as request-time checks.

### Mobile-first screens

These screens are mobile-primary and should be designed thumb-zone first before any desktop layout: breakdown report form, checklist completion, technician task panel, stock-out form, QR scan. PWA (manifest, service worker, offline cache via IndexedDB, FCM) is sprint 6 — don't retrofit it at the end.

## Domain vocabulary (keep Turkish names in UI, English in code)

The users and the spec are Turkish; the code should be English. Use these mappings consistently so screens match the spec:

| Turkish (UI / spec) | English (code) |
| --- | --- |
| Fabrika | Factory (tenant) |
| Arıza | Breakdown |
| Yedek parça | SparePart |
| Otonom bakım | AutonomousMaintenance (checklist) |
| Planlı bakım | PreventiveMaintenance (PM) |
| İş emri | WorkOrder |
| Aksiyon | Action (from abnormal checklist item) |
| Departman | Department |
| Mühendis / Teknisyen | Engineer / Technician |

Breakdown numbering format in the spec is `ARZ-2026-0001`; autonomous-maintenance action numbering is `OB-AKS-2026-0001`. Preserve these exactly — users will recognize and search by them.

## Subscription limits (spec §10.2)

Plans are enforced by Super Admin panel and by runtime checks: Starter (5 users / 20 machines / 5 GB / $99), Professional (15 / 50 / 20 GB / $199), Enterprise (unlimited / 100 GB / $399+). When adding a create-user or create-machine endpoint, check the factory's current plan — don't wait until deploy to wire this up.

## Build / test / lint commands

- `npm run dev` — Next.js dev server (localhost:3000)
- `npm run build` — Production build (ESLint + TypeScript + standalone output)
- `npm start` — Run production build
- `npx prisma migrate dev` — Apply schema migrations
- `npx prisma generate` — Regenerate Prisma client
- `npx prisma db seed` — Base seed (admin + demo users)
- `npx tsx prisma/seed-demo.ts` — 2-3 months demo data for dashboards
- `docker compose up` — Local Docker stack (app + postgres)

## Sprint order (spec §13) — follow unless told otherwise

1. **[DONE]** Project skeleton + Auth + DB (Next.js, Prisma, NextAuth, tenant middleware, seed)
2. **[DONE]** Machine module (CRUD, departments, QR generation)
3. **[DONE]** Breakdown module (report form, state machine, timeline, assignment)
4. **[DONE]** Spare parts + stock (CRUD, in/out forms, machine issue, min-stock alerts)
5. **[DONE]** Autonomous maintenance (templates, completion UI, action workflow)
   - **[SCHEDULER DONE 2026-04-13]** Scheduler service + cron API endpoints + dev-mode in-process scheduler
     - `src/lib/services/scheduler-service.ts` — runBreakdownEscalation, runMissedChecklistMarking, runPmWorkOrderGeneration
     - `src/app/api/cron/escalation/route.ts` — POST (Bearer CRON_SECRET protected)
     - `src/app/api/cron/missed-checklists/route.ts` — POST (Bearer CRON_SECRET protected)
     - `src/app/api/cron/pm-generate/route.ts` — POST (Bearer CRON_SECRET protected)
     - `src/lib/scheduler/dev-scheduler.ts` — setInterval-based in-process scheduler (dev only)
     - `src/lib/scheduler/init.ts` — initScheduler() called at server boot
     - `src/instrumentation.ts` — Next.js instrumentation hook; calls initScheduler()
     - `src/lib/events/types.ts` — added breakdown.escalated event type
6. **[DONE + ENHANCED 2026-04-13]** Notifications + PWA (in-app notifications, SSE streaming, manifest, service worker)
   - Multi-channel dispatch added: email (SMTP/SES via nodemailer) + push (FCM via firebase-admin)
   - `src/lib/services/email-service.ts` — branded HTML email template; env-flag guarded (SMTP_HOST)
   - `src/lib/services/fcm-service.ts` — firebase-admin push; env-flag guarded (FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY)
   - `src/app/api/notifications/preferences/route.ts` — GET/PUT per-user channel preferences
   - `src/app/api/notifications/fcm-token/route.ts` — POST/DELETE FCM token registration
   - `src/app/(app)/bildirimler/tercihler/page.tsx` — checkbox grid UI for channel preferences
7. **[DONE]** Dashboards (admin + technician, MTBF/MTTR/Pareto, cost report, Recharts)
8. **[DONE]** Tenant + deploy (Super Admin panel, factory CRUD, subscriptions, limit enforcement, Docker)

Each sprint is expected to ship a vertically working slice — finish the backend + UI + tests for a module before starting the next. Resist cross-sprint refactors during MVP.

## Out of scope for MVP

ERP integration (§18) is **Phase 2** and must not be started until (a) MVP runs 4 weeks in the pilot factory, (b) at least one prospect asks for it, (c) core is stable. If a task touches ERP adapters, Logo/SAP/Mikro, SQS, or `Integration Gateway`, stop and confirm with the user first.
