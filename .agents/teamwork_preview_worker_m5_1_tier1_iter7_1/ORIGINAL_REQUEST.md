## 2026-07-04T10:34:05Z

You are the Worker (Iteration 7) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_iter7_1`.
Your identity/role is `teamwork_preview_worker`.

Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`, and the Explorer's handoff report at `.agents/teamwork_preview_explorer_m5_1_tier1_iter7_3/handoff.md`.

### Milestone Description & Explorer Findings
The previous iteration failed due to a fatal `pg.Client` reuse bug in `e2e/init_db.ts` (`Error: Client has already been connected. You cannot reuse a client`) because `node-postgres` does not allow calling `client.connect()` multiple times on the same client instance after an initial connection failure. Furthermore, the naive chained retry (`npx supabase start ... || npx supabase start ...`) in `e2e/run_e2e.ts` caused Docker container conflicts (`/supabase_db_expense-dashboard is already in use`), Docker daemon prune collisions (`a prune operation is already running`), and stopped all Supabase services on the third attempt because orphaned cleanup routines from earlier failed attempts executed asynchronously.
Explorer 3 has provided the exact, bulletproof code replacements for `e2e/init_db.ts` and `e2e/run_e2e.ts`.

### Tasks
1. Implement the exact code replacements in `e2e/init_db.ts` recommended by Explorer 3 in its handoff report:
   - Instantiate `const client = new Client({ connectionString })` INSIDE the `while (retries > 0 && !connected)` retry loop on each attempt, ensuring `client.end()` is called on failure if needed, so a fresh client is used for each connection attempt.
2. Implement the exact code replacements in `e2e/run_e2e.ts` recommended by Explorer 3 in its handoff report:
   - In `setup()`, explicitly call `npx supabase stop --no-backup 2>/dev/null || true && sleep 10` before each retry to ensure orphaned cleanup routines from earlier failed attempts are fully complete and terminated before attempting `npx supabase start` again:
     ```typescript
     execSync('npx supabase stop --no-backup 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && sleep 10', { stdio: 'inherit' });
     execSync('npx supabase start --ignore-health-check || (npx supabase stop --no-backup 2>/dev/null || true && sleep 10 && npx supabase start --ignore-health-check) || (npx supabase stop --no-backup 2>/dev/null || true && sleep 10 && npx supabase start --ignore-health-check)', { stdio: 'inherit' });
     ```
3. Ensure `fuser -k 3000/tcp` remains in place (no `pkill -9 -f next`) to prevent process suicide.
4. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` remains without a `try...catch` block to ensure database permissions and RLS disablement are applied genuinely.
5. Ensure `execSync('npx playwright test ...')` remains without a `try...catch` block to guarantee genuine error propagation.
6. Ensure `e2e/run_e2e.ts` retains the 10-second warmup delay before Playwright tests and the resilient Next.js server keep-alive/respawn mechanism (`startNextServer()`, `isShuttingDown` flag, `on('exit')` listener).
7. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
8. Execute the prerequisite process cleanup command to terminate all orphaned test runners and fully prune all containers:
   `fuser -k 3000/tcp 54321/tcp 54322/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true`
9. Run the full test runner command specified in `TEST_READY.md`:
   `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
10. If any tests fail, investigate and implement the necessary fixes in the codebase, then re-verify until all tests pass successfully with exit code 0.
11. Document your commands, changes, and passing test results in `handoff.md` in your working directory, and send a completion message to me.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
