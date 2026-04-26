# ClinicSquad Workspace

## Overview

ClinicSquad is a multi-tenant medical clinic management SaaS for Egyptian clinics. Built as a pnpm monorepo with a React+Vite frontend and Express API backend.

## Product Features

- **Authentication**: Register/Login with sha256+base64 token, stored in localStorage
- **Password Reset**: `/forgot-password` generates a single-use, 1-hour reset token (stored hashed in `password_reset_tokens`). Because no email integration is configured, the token + reset URL are returned in the API response and shown directly on the request page so users can copy them. `/reset-password?token=…` consumes the token and updates the password. Endpoints: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`. Unknown emails return a generic success response (no email enumeration).
- **Change Password (logged-in)**: Settings page → "Change Password" section. Requires current password + new password (min 6 chars). Endpoint: `POST /api/auth/change-password` (Bearer auth). Rejects wrong current password (401) and same-as-current passwords (400).
- **Account Activity Log**: Settings page → "Account Activity" section shows the last 20 sign-in/security events for the logged-in user (timestamp, IP, user agent). Event types: `login_success`, `login_failed`, `password_changed`, `password_reset`. Stored in `auth_events` table; recorded best-effort (logging never breaks an auth flow). Endpoint: `GET /api/auth/events` (Bearer auth, returns top 20 desc by createdAt).
- **Subscribers by Plan (superadmin)**: Admin panel (`/admin`) shows three clickable plan cards (Free Trial / Basic / Premium) with subscriber counts. Clicking a card opens a dialog listing all clinics on that plan with their state. Clicking any clinic opens a detail dialog showing owner contact, team-member breakdown by role, patient/appointment counts, full subscription history, and total confirmed revenue. Endpoint: `GET /api/admin/clinics/:clinicId/detail`.
- **15-Day Free Trial**: New clinics get trial period automatically
- **Subscription Plans**: Basic (200 EGP) / Premium (400 EGP) — WhatsApp payment, confirmed by superadmin
- **Roles**: admin, secretary, nurse, superadmin
- **Team Management** (admin-only): invite secretaries/nurses by email, copyable invite links, capacity meter — trial/basic = 2 members, premium = 10
- **Patient Management**: CRUD with search, blood type, allergies, medical notes
- **Appointment Scheduling**: Create/update/delete appointments, status tracking
- **Finance Dashboard**: Available on all paid plans (basic + premium), income/expense tracking, monthly charts (Recharts)
- **Insights**: Premium-only analytics — performance dashboard, busy-day trends, status breakdown, revenue charts
- **ePrescription** (available on all paid plans, admin-create): per-patient or global `/prescriptions` page (label "ePrescription"), multi-medication form with **live preview panel** (right side, mirrors the print layout — shows clinic name, doctor name + medical specialty, patient name + auto-generated patient code, date, diagnosis, medications added so far, notes, signature). Printable A4 layout (window.print → save as PDF) and "Send to patient WhatsApp" via `wa.me` deep link include the patient code and doctor specialty. Entry points: sidebar nav, patient detail page, and per-row button on the appointments list.
- **Auto-generated patient codes**: every patient gets a unique human-readable code per clinic in `PT-NNNN` format (e.g. `PT-0001`), generated automatically on creation by computing `max(existing numeric suffix) + 1`. Code is shown as a colored pill badge in the patients list and on the patient detail header, in the live ePrescription preview, on the printed Rx, and in the WhatsApp message. Backfill script: `scripts/src/backfill-patient-codes.ts` (run with `pnpm --filter @workspace/scripts exec tsx src/backfill-patient-codes.ts`).
- **Doctor specialty**: `users.specialty` text column (nullable). Editable on the Settings page (admin/superadmin only) under the Profile section. Surfaced under the doctor name on the live preview, the printed Rx footer/signature, and the WhatsApp message. New endpoint: `PATCH /api/auth/me` with `{ name?, specialty? }`.
- **Superadmin Panel**: Activate/block clinics, confirm payments
- **UI**: Dark-by-default, teal+amber theme, responsive

## Architecture

```
artifacts/
  clinic-squad/      React+Vite frontend (port via $PORT)
  api-server/        Express API (port 8080)
  mockup-sandbox/    Design canvas sandbox

lib/
  api-spec/          OpenAPI spec (openapi.yaml)
  api-client-react/  Orval-generated React Query hooks
  api-zod/           Orval-generated Zod schemas
  db/                Drizzle ORM schema + migrations
```

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **Frontend**: React 19, Vite, TailwindCSS v4, shadcn/ui, Wouter routing
- **Backend**: Express 5, TypeScript, esbuild
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (v4), drizzle-zod
- **API codegen**: Orval (from OpenAPI spec)
- **Charts**: Recharts

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Auth

- Password: SHA-256 hash with salt `clinicsquad_salt`, base64 encoded
- Token: SHA-256 of `userId:clinicId:email` with salt, base64 encoded
- Bearer token set via `setAuthTokenGetter` in `main.tsx`
- Vite proxy: `/api` → `http://localhost:8080`

## Demo Credentials

- Admin: admin@demo.com / demo1234
- SuperAdmin: super@clinicsquad.com / super1234

## WhatsApp Support

- Payment confirmation: wa.me/201000000000
- Superadmin confirms via `/admin` → "Confirm Payment" button

## Important Notes

- Orval codegen: do NOT add `schemas: { path: ... }` — causes duplicate exports
- Insights route (`/insights`) is premium-only (locked for trial/basic) — sidebar shows Crown lock for non-premium
- Finances route (`/finances`) is available on all paid plans (basic + premium) and admin-only
- Prescriptions route (`/prescriptions`, displayed as "ePrescription") is available on all paid plans; admin-only for create/delete (backend returns 403 when not admin). Print/WhatsApp helpers live in `artifacts/clinic-squad/src/lib/prescription.ts`.
- Subscription expired → redirected to /subscription/expired
- Generated API hooks require `queryKey` in query options for `enabled` to work
