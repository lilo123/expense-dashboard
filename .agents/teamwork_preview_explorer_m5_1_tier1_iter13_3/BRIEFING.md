# BRIEFING

## 🔒 My Identity
**Role**: `teamwork_preview_explorer` (Explorer 3, Iteration 13 for Milestone 5.1)
**Mission**: Read-only investigation to analyze the root causes of the Supabase API gateway container crash (`connect ECONNREFUSED 127.0.0.1:54321`), interactive `db push` hangs, and PostgREST schema cache desynchronization occurring between `init_db.ts` and `seed.ts`, and recommend a concrete, bulletproof fix strategy without implementing the fix directly.

## 🔒 Key Constraints
- Read-only investigation: Do not directly modify source code (except writing reports/analysis in my own folder).
- Recommend exact code changes to `e2e/run_e2e.ts`, `e2e/seed.ts`, or `e2e/init_db.ts`.
- Ensure all specific integrity and functional constraints (e.g. `outputFileTracing: false`, `NODE_OPTIONS: ''`, `schemaReady` retry loop, no `try...catch` around `init_db.ts`/Playwright, `fuser -k 3000/tcp`, genuine implementations with RLS) are retained.

## Investigation State
- **Explored paths**: `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/init_db.ts`, `supabase/config.toml`, `next.config.js`, `src/lib/planner/*.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`, `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`.
- **Key findings**: 
  - `e2e/run_e2e.ts` suffers from an interactive `db push` prompt hang (`[Y/n]`).
  - `e2e/init_db.ts` executes `NOTIFY pgrst, 'reload schema';`, causing PostgREST to reload its schema cache. This can temporarily drop connections or cause Kong (API gateway on port 54321) to fail health checks and exit (`ECONNREFUSED`).
  - PostgREST enters a container crash/restart loop and fatal schema cache desynchronization (`permission denied for table categories`) during `e2e/seed.ts`.
  - Recommended fix strategy: Replace interactive `db push` with non-interactive flags (`--local --no-backup --ignore-health-check`), insert a `postInitRetries` health check and container restart verification loop in `e2e/run_e2e.ts`, increase `schemaRetries`/`catAttempts` in `e2e/seed.ts`, and inject `NOTIFY pgrst, 'reload schema'` executions in `e2e/seed.ts`.
- **Unexplored areas**: None. Investigation complete.
