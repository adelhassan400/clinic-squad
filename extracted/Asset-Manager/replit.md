# ClinicSquad Workspace

## Overview

ClinicSquad is a multi-tenant medical clinic management SaaS for Egyptian clinics. Built as a pnpm monorepo with a React+Vite frontend and Express API backend.

## Product Features

- **Authentication**: Register/Login with sha256+base64 token, stored in localStorage
- **15-Day Free Trial**: New clinics get trial period automatically
- **Subscription Plans**: Basic (200 EGP) / Premium (400 EGP) — WhatsApp payment, confirmed by superadmin
- **Roles**: admin, secretary, superadmin
- **Patient Management**: CRUD with search, blood type, allergies, medical notes
- **Appointment Scheduling**: Create/update/delete appointments, status tracking
- **Finance Dashboard**: Premium-only, income/expense tracking, monthly charts (Recharts)
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
- Finance route is premium-only (locked for trial/basic)
- Subscription expired → redirected to /subscription/expired
- Generated API hooks require `queryKey` in query options for `enabled` to work
