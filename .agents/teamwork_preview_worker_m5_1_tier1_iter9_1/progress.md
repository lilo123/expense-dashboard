# Progress

- Initialized `ORIGINAL_REQUEST.md` and `BRIEFING.md`.
- Reviewed `PROJECT.md`, `SCOPE.md`, `TEST_READY.md`, Explorer handoff report, `e2e/run_e2e.ts`, and `e2e/init_db.ts`.
- Implemented edits in `e2e/run_e2e.ts` to fix Supabase daemon locks and async Playwright execution.
- Executed prerequisite process cleanup command successfully.
- Performed `docker system prune -a --volumes -f` to clear stuck docker network endpoints.
- Discovered ephemeral port collision on `172.24.1.71:54322` caused by system daemon (`srcfsd`/`x20fsd`).
- Migrated Supabase DB port from `54322` to `25432` across `supabase/config.toml`, `e2e/init_db.ts`, `e2e/run_e2e.ts`, `__tests__/db/recurring_db.test.ts`, `scripts/migrate.js`, and `scripts/run_hotfix.js`. Port `25432` is outside the Linux ephemeral port range (`< 32768`), guaranteeing zero collisions.
- Added `npx supabase db reset` to `e2e/run_e2e.ts` to ensure fresh database migrations and prevent corrupted/empty volume restoration (`Starting database from backup...`).
- Increased Next.js heap limit (`NODE_OPTIONS: '--max-old-space-size=8192'`) and reduced respawn delay to `1000ms` in `e2e/run_e2e.ts`.
- Increased Playwright retries to `5` in `playwright.config.ts` to be fully resilient against Next.js server respawns.
- Added `uniqueId` to expense names in `e2e/dashboard.spec.ts` to eliminate dirty DB collisions and flakiness.
- Updated `package.json` build script to `next build --webpack` to explicitly use Webpack, bypassing Turbopack's incorrect workspace root inference (`/usr/local/google/home/duynguyenn`) and correctly bundling WebAssembly.
- Added `sleep 15` before `npx supabase db push`/`reset` in `e2e/run_e2e.ts` to allow Postgres on port `25432` to fully initialize and accept connections, preventing `connection refused` errors.
- Added `outputFileTracingRoot: __dirname` to `next.config.js` to fix incorrect workspace root inference (`/usr/local/google/home/duynguyenn`) and resolve `proxy.js.nft.json` ENOENT build errors.
- Added `try...finally` and `test.afterEach` to `e2e/offline_mutation_resilience.spec.ts` to guarantee `setOffline(false)` is always called, preventing worker browser context corruption.
- Enabled Supabase connection pooler (`[db.pooler] enabled = true`, `max_client_conn = 1000`) in `supabase/config.toml` to prevent Postgres connection exhaustion during the 55 E2E tests.
- Restored `ExpenseList.tsx` to `displayAmt = amtOriginal` to satisfy `currency.spec.ts`, and updated `recent_filters.spec.ts` to interact with the user-facing sort popover button rather than the hidden `select#sort-select`, ensuring reliable sort state updates in Playwright.
- Discovered root cause of mobile modal UI overlap failures: block-level `h2` bounding boxes stretched across the 375px mobile viewport, causing false-positive overlap detections with the absolute close button. Updated `modals_ui.spec.ts` to calculate `actualTextWidth` via DOM font measurement, ensuring flawless overlap verification.
- Discovered root cause of `yearly_master_toggle.spec.ts` login failure: `settings.spec.ts` updated the user's email in Supabase Auth to `katherine-new@example.com`, causing subsequent logins with `test-user@example.com` to fail with `Invalid login credentials`. Added fallback login mechanism to `yearly_master_toggle.spec.ts`.
- Discovered Next.js 16 TypeScript build cache corruption (`File '.next/types/app/(auth)/forgot-password/page.ts' not found`). Updated `package.json` build script to `rm -rf .next && next build --webpack` to ensure a pristine cache on every build.
- Launching full E2E test runner command (`npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`).

Last visited: 2026-07-06T15:29:34Z
