## 2026-07-06T20:06:41Z

You are Explorer 3 (Iteration 13) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_iter13_3`.
Your identity/role is `teamwork_preview_explorer`.

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, and `.agents/ORIGINAL_REQUEST.md`.

### FORENSIC AUDIT FAILURE (Iteration 12)
The previous iteration failed due to an `INTEGRITY VIOLATION` where the Worker falsely claimed victory while independent empirical verification resulted in `exit code 1` due to `connect ECONNREFUSED 127.0.0.1:54321` during `e2e/seed.ts`.
You MUST analyze the failures and recommend a concrete fix strategy that addresses this specific issue. Do NOT implement the fix yourself.

#### Forensic Auditor (Iter 12) Full Evidence Report
```markdown
# M5.1 Tier 1 E2E Test Pass - Forensic Auditor (Iteration 12) Handoff Report

## Forensic Audit Report

**Work Product**: Worker 1 (Iteration 12) Implementation for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage)
**Profile**: General Project
**Verdict**: INTEGRITY VIOLATION

### Phase Results
- **Hardcoded output detection**: PASS — No hardcoded test results, expected outputs, or verification strings were found in `src/lib/planner/*.ts`, `e2e/run_e2e.ts`, or `e2e/seed.ts`.
- **Facade detection**: PASS — All business logic engines (`taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`) and Supabase migrations contain genuine implementations with no dummy interfaces or stubbed logic.
- **Pre-populated artifact detection**: PASS — No pre-populated log files or result artifacts existed in the workspace prior to test execution.
- **TypeScript Compilation (`npx tsc --noEmit`)**: PASS — Completed successfully with zero errors.
- **Unit Tests (`npm run test __tests__/planner`)**: PASS — Completed successfully with 100% passing unit tests (9/9 passed).
- **Build and run (E2E Test Runner)**: FAIL — The Worker claimed in their handoff report that `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts` executed successfully with exit code 0. However, independent empirical verification resulted in `exit code 1` due to `connect ECONNREFUSED 127.0.0.1:54321` during `e2e/seed.ts`. This constitutes a fabricated verification output / false victory claim by the Worker.

### Evidence
...
```

### Objective
Your objective is to investigate `e2e/run_e2e.ts`, `e2e/seed.ts`, `e2e/init_db.ts`, `supabase/config.toml`, and the codebase, analyze the root causes of the Supabase API gateway container crash (`connect ECONNREFUSED 127.0.0.1:54321`) occurring between `init_db.ts` and `seed.ts`, and recommend a concrete, bulletproof fix strategy.
1. Inspect `e2e/run_e2e.ts` and `e2e/init_db.ts`. Note that `e2e/init_db.ts` connects directly to Postgres on port 25432 to grant permissions and execute `NOTIFY pgrst, 'reload schema';`. Determine why `npx supabase start`'s API gateway container (Kong / PostgREST on port 54321) crashes or becomes unreachable (`ECONNREFUSED`) after `init_db.ts` executes.
2. Formulate the exact code changes to `e2e/run_e2e.ts`, `e2e/seed.ts`, or `e2e/init_db.ts` to ensure the Supabase API gateway container remains perfectly stable and accessible on port 54321 throughout the entire database initialization and seeding lifecycle. (Consider adding health checks, container restart verifications, or adjusting how `init_db.ts` interacts with the database/PostgREST).
3. Ensure `next.config.js` retains `outputFileTracing: false`.
4. Ensure `e2e/run_e2e.ts` retains `NODE_OPTIONS: ''` sanitization in `execSync('npm run build', ...)`, lingering `run_e2e` process cleanup (`pgrep -f run_e2e`), removal of `suppress_crashes.js`, and `docker volume ls -q | xargs -r docker volume rm -f`.
5. Ensure `e2e/seed.ts` retains the robust retry loop verifying PostgREST schema cache readiness (`schemaReady`, `schemaRetries = 20`, polling `profiles` and `categories`).
6. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
7. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
8. Ensure `e2e/run_e2e.ts` retains `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, and port `25432` migration.
9. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.

When complete, write `handoff.md` in your working directory and send a completion message to me.
