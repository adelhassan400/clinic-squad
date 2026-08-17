Pricing synchronization verification (2026-08-12):

- Added a new public API endpoint `GET /api/platform/public-pricing` in `admin-tools.ts` that exposes global pricing without authentication.
- Updated `landing.tsx` to fetch pricing data using `useQuery` and `customFetch`.
- Rebuilt and restarted the API server to register the new endpoint.
- Verified via `curl` that the endpoint returns the latest saved prices (Basic: 400, Premium: 700).
- Verified via live preview that the landing page pricing cards now dynamically display "400 EGP/month" and "700 EGP/month" instead of hardcoded values.
- The system now ensures that any price changes made in the Super Admin dashboard are instantly reflected for all visitors on the landing page.
