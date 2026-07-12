# BRIEFING — 2026-07-04T10:32:00Z

## Mission
Investigate E2E test runner failures (`e2e/init_db.ts` pg.Client reuse bug and `e2e/run_e2e.ts` Supabase start/stop container conflicts), verify integrity requirements, and recommend a concrete, bulletproof fix strategy for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).

## 🔒 My Identity
- Archetype: teamwork_preview_explorer
- Roles: Explorer 2 (Iteration 7) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage)
- Working directory: /usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter7_2
- Original parent: a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3
- Milestone: Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement fixes directly.
- Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`).
- Ensure `try...catch` blocks around `e2e/init_db.ts` and Playwright tests remain removed.
- Ensure `e2e/run_e2e.ts` retains `sleep 10` decoupling, warmup delays, and Next.js server keep-alive/respawn mechanism.
- Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.

## Current Parent
- Conversation ID: a2dfdb1c-4cd3-448f-b6c1-9f62b94fa3c3
- Updated: 2026-07-04T10:32:00Z

## Investigation State
- **Explored paths**: `e2e/init_db.ts`, `e2e/run_e2e.ts`, `src/lib/planner/*`, `supabase/migrations/20260624000000_retirement_planner.sql`, `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`.
- **Key findings**: 
  1. `e2e/init_db.ts` instantiates `pg.Client` outside the retry loop. When `client.connect()` fails during Postgres startup, the client enters an un-reusable error state, causing instant failures on subsequent retries.
  2. `e2e/run_e2e.ts` uses a naive chained retry (`npx supabase start ... || npx supabase start ...`) which collides with asynchronous cleanup routines (`Stopping containers...`), leading to container conflicts, Docker prune collisions, and eventual `connect ECONNREFUSED` errors.
  3. All integrity requirements (absence of `pkill -9 -f next`, absence of suppressing `try...catch` blocks, presence of Next.js respawn mechanism, genuine RLS policies, and Premium tier triggers) are confirmed intact.
- **Unexplored areas**: None.

## Key Decisions Made
- Recommended exact code changes for `e2e/init_db.ts` to instantiate a fresh `pg.Client` inside the retry loop.
- Recommended exact code changes for `e2e/run_e2e.ts` to explicitly call `npx supabase stop --no-backup 2>/dev/null || true && sleep 10` before each retry.

## Artifact Index
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter7_2/ORIGINAL_REQUEST.md` — Original user request and system messages.
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter7_2/progress.md` — Liveness heartbeat and progress tracking.
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter7_2/handoff.md` — 5-component handoff report detailing observations, logic chain, caveats, conclusions, and verification methods.
