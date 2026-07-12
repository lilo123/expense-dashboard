## 2026-07-06T16:10:20Z

You are the Worker (Iteration 10) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_iter10_1`.
Your identity/role is `teamwork_preview_worker`.

Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`, and the Explorer's handoff report at `.agents/teamwork_preview_explorer_m5_1_tier1_iter10_3/handoff.md`.

### Milestone Description & Explorer Findings
The previous iteration failed due to an INTEGRITY VIOLATION and several critical vulnerabilities: Supabase CLI daemon locks (`supabase start is already running.`) caused by lingering lock files in `supabase/.temp/`, PostgREST schema cache disruption caused by aggressive Supabase restart polling in `e2e/seed.ts`, Supabase Auth rate limit exhaustion (`email_sent = 2`), a Next.js watchdog fork bomb (`watchdogInterval` and `nextServer.on('exit')` colliding without a mutex lock), and business logic gaps in `simulator.ts` (OAS clawback hardcoding) and `drawdownEngine.ts` (NonRegistered account principal taxation).
Explorer 3 has provided the exact, bulletproof code replacements across `src/lib/planner/types.ts`, `src/lib/planner/drawdownEngine.ts`, `src/lib/planner/simulator.ts`, `e2e/run_e2e.ts`, `e2e/seed.ts`, and `supabase/config.toml`.

### Tasks
1. Implement the exact code replacements in `src/lib/planner/types.ts` recommended by Explorer 3 in its handoff report:
   - Add `costBasis: z.number().min(0).optional()` to `AccountSchema`.
2. Implement the exact code replacements in `src/lib/planner/drawdownEngine.ts` recommended by Explorer 3 in its handoff report:
   - Update `DrawdownResult` to include `taxableIncome` and correctly tax only the growth portion of `NonRegistered`/`Taxable` accounts (`toWithdraw * growthRatio * 0.5`) while reducing `costBasis` proportionally.
3. Implement the exact code replacements in `src/lib/planner/simulator.ts` recommended by Explorer 3 in its handoff report:
   - Update `runPlannerSimulation` to initialize `costBasis`, dynamically calculate `netIncomeForOas = baseTotalPension + drawdownTaxableIncome`, apply OAS clawbacks, and perform a secondary drawdown if needed.
4. Implement the exact code replacements in `e2e/run_e2e.ts` recommended by Explorer 3 in its handoff report:
   - Add `rm -rf supabase/.temp 2>/dev/null || true` before every `npx supabase start` invocation.
   - Implement the shared `isNextServerRestarting` mutex lock between `nextServer.on('exit')` and `watchdogInterval`, with relaxed watchdog thresholds (`watchdogFailures >= 15`).
5. Implement the exact code replacements in `e2e/seed.ts` recommended by Explorer 3 in its handoff report:
   - Remove the aggressive Supabase restart logic (`execSync('npx supabase start --ignore-health-check')`) during Auth polling.
6. Implement the exact code replacements in `supabase/config.toml` recommended by Explorer 3 in its handoff report:
   - Increase `email_sent` under `[auth.rate_limit]` to `email_sent = 1000`.
7. Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
8. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
9. Ensure `e2e/run_e2e.ts` retains asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, and port `25432` migration.
10. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
11. Execute the prerequisite process cleanup command to terminate all orphaned test runners and fully prune all containers:
    `fuser -k 3000/tcp 54321/tcp 54322/tcp 25432/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true`
12. Verify TypeScript compilation and type safety:
    `npx tsc --noEmit`
13. Verify Unit Tests for Planner Business Logic Engines:
    `npm run test __tests__/planner`
14. Run the full test runner command specified in `TEST_READY.md`:
    `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
15. If any tests fail, investigate and implement the necessary fixes in the codebase, then re-verify until all tests pass successfully with exit code 0.
16. Document your commands, changes, and passing test results in `handoff.md` in your working directory, and send a completion message to me.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
