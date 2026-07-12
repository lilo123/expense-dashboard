# Scope: Milestone 5.4 (Tier 4 E2E Test Pass - Real-World Application Scenarios)

## Architecture
- **Goal**: Achieve 100% passing Tier 4 E2E tests (Real-World Application Scenarios) with exit code 0.
- **Components**: Supabase backend (Kong API Gateway, GoTrue Auth, PostgREST, Postgres, Realtime, Pooler), Next.js frontend/server, Playwright E2E test runner (`e2e/run_e2e.ts`), seed script (`e2e/seed.ts`), database initialization (`e2e/init_db.ts`), retirement planner business logic engines (`src/lib/planner/*.ts`), and Zod schemas (`src/schemas/*.ts`).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M5.4.1: Tier 4 Verification & Fix Loop | Run Explorer -> Worker -> Reviewer -> gate loop until all Tier 4 E2E tests pass or 32 iterations reached | M5.3 | IN_PROGRESS |

## Interface Contracts
### `e2e/run_e2e.ts` <-> Supabase & Next.js
- **Supabase Realtime**: `[realtime] enabled = true` in `supabase/config.toml`; explicit health check loop for `http://127.0.0.1:54321/realtime/v1/health` accepting HTTP 200, 404, or `res.ok`.
- **Teardown Sequence**: Standardized bulletproof teardown sequence across all 9 locations (`npx supabase stop`, `pkill -9 -f supabase`, `pkill -9 -f supabase-go`, `pkill -9 -f npx supabase`, `docker rm -f`, `docker volume rm -f`, `while docker ps -aq`, `fuser -k 25432/tcp`, `rm -rf supabase/.temp`, `sleep 20`) ensuring `pkill` executes after `docker rm -f` to prevent `supabase-go` daemon corruption.
- **Process Hierarchy**: Invoked via `exec npx tsx e2e/run_e2e.ts` to align process tree with grandparent PID filtering guardrail.
- **Port**: Supabase DB runs on port `25432`.
- **Next.js Build**: `outputFileTracing: false` in `next.config.js` and `NODE_OPTIONS: ''` sanitization during `npm run build`.

### `src/app/(dashboard)/budget/loading.tsx` <-> `src/components/BudgetPlanner.tsx`
- **DOM Alignment**: `loading.tsx` matches `BudgetPlanner.tsx` DOM structure perfectly, implementing `max-h-[40dvh] overflow-y-auto pr-2` on the category rows container to eliminate Cumulative Layout Shift (CLS).

### `e2e/seed.ts` <-> Supabase Kong & PostgREST
- **Seeding Resilience**: Robust retry loops for data deletion (`expenses`, `categories`, `recurring_expenses`) and user creation/deletion (`deleteUser`, `createUser`) to recover from transient HTTP 502 Bad Gateway errors.
- **PostgREST Schema Cache**: `schemaRetries = 50` in `seed.ts` and `setTimeout(resolve, 10000)` in `init_db.ts`.

## Code Layout
- `supabase/config.toml`: Supabase configuration (Realtime, Pooler, Auth rate limits, Port 25432).
- `e2e/run_e2e.ts`: Master E2E test runner.
- `src/app/(dashboard)/budget/loading.tsx`: Budget streaming loading skeleton.
- `src/lib/planner/*.ts`: Retirement planner business logic engines (tax, pension, spending, drawdown, simulator).
- `src/schemas/*.ts`: Zod validation schemas.
- `__tests__/planner/planner.test.ts`: Comprehensive unit tests.
- `e2e/adv_*.ts`: Adversarial test scripts.
