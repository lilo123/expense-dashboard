## 2026-07-06T20:11:33Z

You are the Worker (Iteration 13) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_iter13_1`.
Your identity/role is `teamwork_preview_worker`.

Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`, and the Explorer's handoff report at `.agents/teamwork_preview_explorer_m5_1_tier1_iter13_1/handoff.md`.

### Milestone Description & Explorer Findings
In Iteration 12, the Forensic Auditor, Reviewer 1, Reviewer 2, and Challenger 1 uncovered three critical E2E setup flaws: `e2e/run_e2e.ts` suffering from an interactive `db push` prompt hang (`[Y/n]`) that triggers a fallback `db reset`, `e2e/init_db.ts` modifying database privileges while PostgREST is actively attempting to build its schema cache (causing a PostgREST container crash/restart loop `Could not query the database for the schema cache. Retrying.`), and `e2e/seed.ts` failing with `connect ECONNREFUSED 127.0.0.1:54321` and `permission denied for table categories`.
Explorer 1 has provided the exact, bulletproof code replacements across `e2e/run_e2e.ts`, `e2e/seed.ts`, and `e2e/init_db.ts`.

### Tasks
1. Implement the exact code replacements in `e2e/run_e2e.ts` recommended by Explorer 1 in its handoff report:
   - Replace `npx supabase db push --db-url ...` with `npx supabase migration up --include-all` to eliminate interactive prompt hangs.
   - Insert the pre-seed Supabase stabilization health check (`preSeedRetries = 20`, polling `http://127.0.0.1:54321` and restarting Supabase via `rm -rf supabase/.temp 2>/dev/null || true` and `npx supabase start --ignore-health-check` if unresponsive) between `init_db.ts` and `seed.ts`.
2. Implement the exact code replacements in `e2e/seed.ts` recommended by Explorer 1 in its handoff report:
   - Increase `schemaRetries` from `20` to `50`.
   - Insert the robust schema cache reload mechanism (`try { execSync('npx tsx e2e/init_db.ts', { stdio: 'ignore' }); } catch(e){}`) inside the `catAttempts` loop if `catError` occurs.
3. Implement the exact code generational replacements in `e2e/init_db.ts` recommended by Explorer 1 in its handoff report:
   - Increase the post-notification delay timeout from `5000` to `10000` ms (`setTimeout(resolve, 10000)`).
4. Ensure `next.config.js` retains `outputFileTracing: false`.
5. Ensure `e2e/run_e2e.ts` retains `NODE_OPTIONS: ''` sanitization in `execSync('npm run build', ...)`, lingering `run_e2e` process cleanup (`pgrep -f run_e2e`), removal of `suppress_crashes.js`, and `docker volume ls -q | xargs -r docker volume rm -f`.
6. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
7. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
8. Ensure `e2e/run_e2e.ts` retains `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, and port `25432` migration.
9. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
10. Execute the prerequisite process cleanup command to terminate all orphaned test runners, fully prune all containers, and purge all volumes:
    `fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true`
11. Verify TypeScript compilation and type safety:
    `npx tsc --noEmit`
12. Verify Unit Tests for Planner Business Logic Engines:
    `npm run test __tests__/planner`
13. Run the full test runner command specified in `TEST_READY.md`:
    `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
14. If any tests fail, investigate and implement the necessary fixes in the codebase, then re-verify until all tests pass successfully with exit code 0.
15. Document your commands, changes, and passing test results in `handoff.md` in your working directory, and send a completion message to me.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
