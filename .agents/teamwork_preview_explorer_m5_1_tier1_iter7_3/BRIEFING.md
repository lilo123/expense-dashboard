# BRIEFING — 2026-07-04T10:33:40Z

## Mission
Investigate `e2e/init_db.ts` and `e2e/run_e2e.ts`, analyze the root causes of the `pg.Client` reuse bug and Supabase Docker start/cleanup collisions, and recommend a concrete, bulletproof fix strategy for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: teamwork_preview_explorer
- Working directory: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter7_3
- Original parent: a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3
- Milestone: Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Ensure `pg.Client` instantiation is inside retry loop in `e2e/init_db.ts` with `client.end()` on failure
- Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts`
- Ensure `try...catch` blocks around `e2e/init_db.ts` and Playwright tests remain removed in `e2e/run_e2e.ts`
- Ensure `e2e/run_e2e.ts` retains `sleep 10` decoupling, warmup delays, and resilient Next.js server keep-alive/respawn mechanism
- Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
- Recommend the exact fix for `e2e/run_e2e.ts` to explicitly call `npx supabase stop --no-backup 2>/dev/null || true && sleep 10` before each retry to prevent asynchronous cleanup collisions.

## Current Parent
- Conversation ID: a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3
- Updated: 2026-07-04T10:31:29Z

## Investigation State
- **Explored paths**: `e2e/init_db.ts`, `e2e/run_e2e.ts`, `src/lib/planner/*.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`, `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`
- **Key findings**: 
  1. `e2e/init_db.ts` instantiates `pg.Client` outside the retry loop. When the first connection attempt fails while Postgres is initializing, the client enters an un-reusable error state (`Error: Client has already been connected. You cannot reuse a client.`), causing all 15 retries to fail instantly.
  2. `e2e/run_e2e.ts` uses a naive chained retry (`npx supabase start --ignore-health-check || ...`) which executes while Supabase's asynchronous cleanup routine (`Stopping containers...`) from the failed attempt is still active. This causes `supabase start is already running.` errors, container conflicts (`/supabase_db_expense-dashboard is already in use`), and Docker daemon prune collisions (`a prune operation is already running`). Eventually, the delayed cleanup stops all Supabase services, resulting in `connect ECONNREFUSED 127.0.0.1:54321` during database seeding (`e2e/seed.ts`).
  3. `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` are genuinely implemented with real equations, sorting, strict RLS policies (`auth.uid() = user_id`), and Premium tier check triggers (`check_premium_simulation_range()`).
- **Unexplored areas**: None. Investigation complete.

## Key Decisions Made
- Formulate a precise, drop-in replacement recommendation for `e2e/init_db.ts` to instantiate `pg.Client` inside the retry loop.
- Formulate the exact chained retry fix for `e2e/run_e2e.ts` to explicitly call `npx supabase stop --no-backup 2>/dev/null || true && sleep 10` before each retry.

## Artifact Index
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter7_3/ORIGINAL_REQUEST.md — Original request from parent
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter7_3/progress.md — Liveness heartbeat
- /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter7_3/handoff.md — Handoff report with observations, logic chain, caveats, conclusions, and verification methods
