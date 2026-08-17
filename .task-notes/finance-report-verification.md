Finance report verification (2026-08-12):

- Before rebuilding/restarting the API, GET /api/admin/finance-report?year=2026 returned HTTP 404 because the running dist bundle did not contain the route.
- Rebuilt artifacts/api-server/dist and restarted the API with the provisioned DATABASE_URL and PORT=8080.
- Unauthenticated curl then returned HTTP 401 Unauthorized, confirming the route is registered and protected.
- The authenticated live preview opened /platform-finances successfully after the restart. The dashboard displayed the 2026 selector, CSV button, KPI cards, monthly chart, plan/clinic sections, and transaction history. It showed zero values because there were no confirmed payments in the selected period, not because of an API error.
- Root cause: stale backend process/bundle, not the frontend report page or aggregation response shape.
