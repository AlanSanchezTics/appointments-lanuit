# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Appointments La Nuit: booking system for a nail salon. Public flow (book `/citas/[month]`, cancel `/cancelar`, `/my-appointments`) plus an admin panel (`/admin/*`). Next.js 15 App Router + React 19, TypeScript, Tailwind v4, Prisma + MySQL 8.4, NextAuth v5 (admin), `react-i18next` (es/en, resources in `locales/`), Google Calendar sync. Docs are written in Spanish and English; `README.md` has full setup.

## Commands

```bash
npm install
cp .env.example .env && docker compose up -d     # local MySQL
npm run prisma:generate && npm run prisma:migrate
npm run dev                                      # http://localhost:3000

npm run lint
npm run lint:admin-i18n                          # admin-only lint incl. i18n rules
npm run build
npm test                                         # vitest run (jsdom, tests/**/*.test.ts[x])
npx vitest run tests/lib/some-file.test.ts       # single test file
npx vitest run -t "test name"                    # single test by name
npm run test:e2e                                 # Playwright
```

Integration tests (`tests/integration`) hit a real MySQL and are skipped unless `DATABASE_URL` is set **and** `ENABLE_INTEGRATION_DB=1`. Run with `npm run test:integration` (single worker) or `npm run test:integration:file -- <path>`.

Ops scripts (`scripts/*.mjs`, loaded with `.env`): `admin:create`, `locks:cleanup`, `months:reconcile`, `calendar:smoke`, `appointments:retry-sync-failed`, `blocked-slots:retry-sync-failed`, `appointments:reject-pending`, `appointments:import-historic[:apply]`, `appointment-logs:backfill`. Runbooks live in `docs/runbooks/`.

Pre-publish check: `npm run lint && npm test && npm run build`.

## Architecture

Layering (enforced by `docs/architecture/directory-conventions.md`):

- `app/` – routes/pages only; `app/api/**` is thin HTTP transport: parse input, call `lib/`, map domain errors to stable `errorCode` responses. No business logic here.
- `lib/<feature>/` – domain logic (e.g. `lib/appointments/book-appointment.ts`, `lock-reservation-slot.ts`), `lib/validation`, `lib/db` (Prisma client), `lib/calendar` (Google sync), `lib/shared` for utilities.
- `hooks/<feature>/` – **all** component state/effects/interaction logic must live in hooks (no multiple `useState`/`useEffect` in components).
- `components/<feature>/` – feature UI; `components/admin/ui/` – the admin design-system components.
- `middleware.ts` + `auth.ts` – protect `/admin/*` (redirect to `/admin/login`).

Key domain facts (source of truth: `docs/architecture/business-rules.md`):

- MySQL is the source of truth; Google Calendar is synced **after commit**. Failed syncs become `SYNC_FAILED` and are retried by scripts. Active statuses are `CONFIRMED` and `SYNC_FAILED`.
- Only `ACTIVE` months (`active_months`) accept bookings. Business timezone `America/Mexico_City`. Fixed slots 09:00/10:00/13:00/14:00/17:00/18:00, max 3 active appointments/day.
- Slot locks (`reservation_locks`) have a 10-minute TTL during booking.
- Web cancellation requires ≥24h notice. Same phone may hold several active appointments in a month only with ≥15 days separation.
- Appointment changes are audited in `AppointmentLog` (admin actions: confirm/reject/cancel/reschedule, blocked slots, etc.).
- Schema: `prisma/schema.prisma` (Appointment, AppointmentLog, Client, ReservationLock, ActiveMonth, AdminUser, BlockedSlot).

## Conventions and required process (from AGENTS.md)

- **Docs are the contract.** Before changing any flow, read `docs/specification.md`, `docs/architecture/business-rules.md`, and the matching `docs/features/<feature>-flow.md`. Update them in the same change; a flow change without a `docs/specification.md` update is incomplete. Architecture decisions go in `docs/architecture/` and `docs/decisions/`. `specs/*` (Spec Kit) is temporary and never overrides `docs/*`.
- Deliverables for flow changes include a **Documentation Impact** note and a **Flow Contract Check**; data-model changes include a **Migration Compatibility Check**; admin UI changes include an **Admin UI Check** (formats in `AGENTS.md`). Plans follow 4 phases: backend/migrations, UI/UX, tests/rollout, cleanup.
- Admin UI: build only from `components/admin/ui/`, use tokens from `docs/ui/admin/{design-system,tokens,components}.md`, document new reusable components, and never mix admin and public-flow UI systems.
- Admin notifications: use `sileo` exclusively (`sileo.success/error/warning/info/action/promise`), with text through `react-i18next`. No other toast libraries.
- New route names: English, lowercase, kebab-case (legacy `citas`/`cancelar` stay).
- Path alias `@/` maps to repo root.

@AGENTS.md
