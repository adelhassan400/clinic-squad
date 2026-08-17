Finance month filtering verification

- Frontend build completed successfully with Vite using PORT=5173 and BASE_PATH=/.
- Rebuilt and restarted the API server on port 8080 with the provisioned DATABASE_URL.
- Live Revenue page at /platform-finances shows the year selector and a month selector with All months plus January through December.
- Selecting January updates the KPI period label to January 2026 · EGP and displays the month-specific empty state when there are no confirmed payments.
- English labels verified in the live preview. Arabic labels were added in lang.tsx for the selector and All months option.
- Full monorepo typecheck still reports an unrelated pre-existing admin.ts phone property error at line 323; no new type errors were reported for platform-finances.tsx or lang.tsx.
- Backend build completed successfully.

Timestamp: 2026-08-13

