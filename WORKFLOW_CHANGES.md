# Queue, arrival and consultation-save changes

## Scope
- Complete server-side queue ordered by check-in time, with assigned-doctor filtering and 15-second refresh on queue/appointment screens.
- All new, returning, scheduled and legacy/bulk arrivals share a transaction. Patient queue state, appointment and cash ledger change together. Concurrent repeats are rejected.
- Scheduled arrivals reuse their appointment and fee. An arrival click alone does not claim cash was collected. Previously paid patients retain advance payment; completed visits do not carry their old payment into the next visit.
- Consultation saves are serialized, show pending/failure/retry state and hold in-app navigation (including Back) until saving succeeds. Closing/reloading with unsaved changes triggers the browser warning.
- Consultation and embedded prescription components are keyed by clinic/patient so another patient's state cannot leak into the next screen.

## Before rollout
Apply `lib/db/migrations/20261123_queue_check_in.sql` before starting the new application version. Historical active patients have no real arrival timestamp. The migration uses their last update as a best-effort backfill; new arrivals use the actual check-in time. No merge or deployment is included in this change.

The lightweight SQLite demo server is a separate implementation. These regression tests deliberately exercise the real PostgreSQL Express handlers, not that demo. Use PostgreSQL to evaluate this PR.

## Verification
With dependencies installed and a throwaway PostgreSQL database/schema:

```
pnpm typecheck
PORT=5000 BASE_PATH=/ pnpm build
DATABASE_URL=postgresql://... pnpm test:security
DATABASE_URL=postgresql://... pnpm test:workflows
DATABASE_URL=postgresql://... CHROME_PATH=/usr/bin/google-chrome node tests/workflows/ui-check.mjs
```

UI verification starts an isolated API on 8081 and preview on 5100. It covers failed-save navigation blocking, retry, latest-text flush, patient switching and browser Back. Screenshots use synthetic patients only. Existing bundle-size warnings remain.
