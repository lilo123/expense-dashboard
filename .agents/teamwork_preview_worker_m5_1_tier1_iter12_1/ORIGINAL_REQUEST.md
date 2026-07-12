## 2026-07-06T19:45:16Z

You are the Worker (Iteration 12) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_iter12_1`.
Your identity/role is `teamwork_preview_worker`.

Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`, and the Explorer's handoff report at `.agents/teamwork_preview_explorer_m5_1_tier1_iter12_3/handoff.md`.

### Milestone Description & Explorer Findings
In Iteration 11, Reviewer 1, Reviewer 2, and the Forensic Auditor confirmed that all domain logic engines (`types.ts`, `drawdownEngine.ts`, `simulator.ts`, `config.toml`), Zod schemas, Supabase rate limits, unit tests, `outputFileTracing: false`, `NODE_OPTIONS` sanitization, lingering `run_e2e` process cleanup, and E2E tests are genuinely and correctly implemented with zero cheating or integrity violations (Verdict: CLEAN / APPROVE).
However, Challenger 1 and the Forensic Auditor uncovered two critical Supabase container and PostgREST schema cache race conditions: `npx supabase start` failing due to lingering corrupted Docker volumes (`expense-dashboard_supabase_db_expense-dashboard`), and `e2e/seed.ts` failing with `permission denied for table profiles/categories` because table operations are attempted before PostgREST has fully reloaded its schema cache.
Explorer 3 has provided the exact, bulletproof code replacements across `e2e/run_e2e.ts` and `e2e/seed.ts`.

### Tasks
1. Implement the exact code replacements in `e2e/run_e2e.ts` recommended by Explorer 3 in its handoff report:
   - Add `try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}` to `setup()` (both initial cleanup and retry block) and `cleanup()`.
2. Implement the exact code replacements in `e2e/seed.ts` recommended by Explorer 3 in its handoff report:
   - Insert the robust retry loop verifying PostgREST schema cache readiness (`schemaReady`, `schemaRetries = 20`, polling `supabase.from('profiles').select('*').limit(1)` and `supabase.from('categories').select('*').limit(1)` with a 3-second delay) immediately after the Supabase Auth check, before any table deletions, profile upserts, or category fetching.
3. Ensure `next.config.js` retains `outputFileTracing: false`.
4. Ensure `e2e/run_e2e.ts` retains `NODE_OPTIONS: ''` sanitization in `execSync('npm run build', ...)`, lingering `run_e2e` process cleanup (`pgrep -f run_e2e`), and the removal of `suppress_crashes.js`.
5. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
6. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
7. Ensure `e2e/run_e2e.ts` retains `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, and port `25432` migration.
8. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
9. Execute the prerequisite process cleanup command to terminate all orphaned test runners, fully prune all containers, and purge all volumes:
    `fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`
10. Verify TypeScript compilation and type safety:
    `npx tsc --noEmit`
11. Verify Unit Tests for Planner Business Logic Engines:
    `npm run test __tests__/planner`
12. Run the full test runner command specified in `TEST_READY.md`:
    `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
13. If any tests fail, investigate and implement the necessary fixes in the codebase, then re-verify until all tests pass successfully with exit code 0.
14. Document your commands, changes, and passing test results in `handoff.md` in your working directory, and send a completion message to me.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
