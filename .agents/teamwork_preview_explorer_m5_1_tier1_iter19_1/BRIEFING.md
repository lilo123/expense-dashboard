# BRIEFING — 2026-07-06T23:49:23Z

## Mission
Investigate E2E test runner failures (`LegacyDbConnectError`, `supabase_pooler exited`, `supabase start is already running`, `relation public.expenses does not exist`, `a prune operation is already running`, `TypeError: fetch failed`) and recommend a concrete, bulletproof fix strategy.

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: teamwork_preview_explorer
- Working directory: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter19_1
- Original parent: a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3
- Milestone: M5.1 (Tier 1 E2E Test Pass - Feature Coverage)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- All work must be executed locally; do NOT push anything to git

## Current Parent
- Conversation ID: a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3
- Updated: 2026-07-06T23:49:23Z

## Investigation State
- **Explored paths**: `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/init_db.ts`, `supabase/config.toml`, `next.config.js`, `supabase/migrations/20260624000000_retirement_planner.sql`, `e2e/adv_supabase_lifecycle.ts`, `src/lib/planner/*.ts`.
- **Key findings**: 
  1. `pkill -9 -f supabase` before `npx supabase stop` causes a Docker daemon race condition where containers continue starting asynchronously in the background, writing `status.json` and causing subsequent `npx supabase start` to abort with `supabase start is already running`.
  2. `cleanup()` uses an unprotected legacy teardown sequence (`npx supabase stop` followed immediately by `docker volume rm -f`), causing `a prune operation is already running`.
  3. 2s health check polling interval causes cascading restart collisions at retries 15, 10, and 5 because Supabase takes >10s to boot, leading to container thrashing (`TypeError: fetch failed`).
  4. Polling `http://127.0.0.1:54321` (Kong API Gateway) ignores underlying Postgres database container initialization delays/crashes, leading to `LegacyDbConnectError: failed to connect to postgres` and `supabase_pooler` exiting.
- **Unexplored areas**: None. All root causes identified and fix strategy formulated.

## Key Decisions Made
- Reorder teardown sequence across all 7 locations in `e2e/run_e2e.ts` (`npx supabase stop` and Docker cleanup BEFORE `pkill -9 -f supabase`, removing `supabase/.temp` at the very end).
- Increase health check polling interval from 2000ms to 5000ms and add `sleep 20` post-start stabilization delays.
- Add explicit Postgres database readiness verification at port 25432 using `pg.Client` before running migrations, and replace `npx supabase db reset` with full stop/start recovery cycles.

## Artifact Index
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter19_1/ORIGINAL_REQUEST.md` — Store original request for Iteration 19 Explorer 1
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter19_1/handoff.md` — 5-component handoff report with concrete fix strategy
