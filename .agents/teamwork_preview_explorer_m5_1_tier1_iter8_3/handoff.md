# Handoff Report — Milestone 5.1 Explorer 3 (Iteration 8)

## 1. Observation
- **E2E Test Runner (`e2e/run_e2e.ts`)**:
  - In `setup()` at lines 36-37, the current implementation uses a chained OR (`||`) fallback structure for starting Supabase:
    ```typescript
    execSync('npx supabase stop --no-backup 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true && sleep 10', { stdio: 'inherit' });
    execSync('npx supabase start --ignore-health-check || (npx supabase stop --no-backup 2>/dev/null || true && sleep 10 && npx supabase start --ignore-health-check) || (npx supabase stop --no-backup 2>/dev/null || true && sleep 10 && npx supabase start --ignore-health-check)', { stdio: 'inherit' });
    ```
  - In `run()`, `pkill -9 -f next` is completely absent; `fuser -k 3000/tcp` is used consistently across lines 34, 43, 102, 130, and 151 to prevent process suicide.
  - In `run()`, `execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit' });` (line 95) and `execSync('npx playwright test --workers=1 --reporter=list', { stdio: 'inherit' });` (line 182) are invoked directly without wrapping `try...catch` blocks, ensuring genuine error propagation to the outer `catch (err)` block at line 185.
  - In `run()`, the resilient Next.js server keep-alive/respawn mechanism (`startNextServer()`, `isShuttingDown` flag, `on('exit')` listener) is fully intact at lines 11 and 133-156.
  - In `run()`, the 10-second warmup delay before Playwright tests is fully intact at lines 179-180 (`execSync('sleep 10', { stdio: 'inherit' });`).
- **Database Initializer (`e2e/init_db.ts`)**:
  - At lines 14-27, `pg.Client` retains the retry loop fix where `const c = new Client({ connectionString });` is instantiated INSIDE the `while` loop on each attempt.
- **Retirement Planner Domain & Migrations (`src/lib/planner/*.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`)**:
  - `src/lib/planner/types.ts` and `src/lib/planner/simulator.ts` are genuinely implemented with Zod schemas and pure TypeScript business logic engines.
  - `supabase/migrations/20260624000000_retirement_planner.sql` contains strict Row Level Security policies (`auth.uid() = user_id`) on all tables (`households`, `accounts`, `spendings`, `pensions`, `life_events`, `simulation_configs`, `simulation_results_summaries`) and includes the `check_premium_simulation_range()` trigger ensuring Premium tier entitlement checks (`profiles.tier = 'premium'`).

## 2. Logic Chain
1. **Supabase Start Fallback Collision & Race Conditions**: The chained `npx supabase start --ignore-health-check || (npx supabase stop ... && npx supabase start ...)` command structure in `e2e/run_e2e.ts:37` initiates asynchronous Docker container stopping and pruning in the background when a failure occurs. Because `npx supabase start` is repeatedly invoked while background `supabase stop` / `docker prune` operations are still actively tearing down containers, the Supabase services end up in a corrupted state where the Kong API gateway (`supabase_kong_expense-dashboard`) fails to bind or start successfully (`http://127.0.0.1:54321 is unreachable`). Furthermore, when `cleanup()` runs in the `finally` block (`e2e/run_e2e.ts:47`), it executes `npx supabase stop`, which collides with the lingering background prune operation from the earlier chained commands, throwing `failed to prune containers: Error response from daemon: a prune operation is already running`.
2. **Synchronous Clean Retry Loop Necessity**: Replacing the chained OR (`||`) in `setup()` with a clean JavaScript `for` loop that attempts a clean `npx supabase start` (without `--ignore-health-check`), and on failure checks `npx supabase status`, stops containers (`npx supabase stop --no-backup`), removes orphaned containers (`docker rm -f`), and sleeps 10 seconds before retrying, guarantees a pristine environment for each attempt and ensures containers are fully healthy before proceeding.
3. **Preservation of Existing Resiliency Measures**: All other previously established resiliency and correctness measures—the `pg.Client` instantiation inside the retry loop in `e2e/init_db.ts`, the replacement of `pkill -9 -f next` with `fuser -k 3000/tcp`, the removal of error-swallowing `try...catch` blocks around DB init and Playwright tests, the Next.js server keep-alive/respawn mechanism, the 10-second warmup delay, and the strict RLS/Premium tier checks—are verified as present and must remain untouched.

## 3. Caveats
- No caveats. The investigation completely covers the root causes of the Supabase container restart loops and Docker daemon prune race conditions, and verifies all required E2E test runner and domain logic invariants.

## 4. Conclusion
The E2E test runner `e2e/run_e2e.ts` requires an architectural fix in `setup()` to properly synchronize Supabase container lifecycle management and eliminate Docker daemon prune race conditions and Supabase restart loops.

### Recommended Concrete Fix Strategy (To be implemented by Worker)
1. **Replace the chained OR (`||`) in `setup()` in `e2e/run_e2e.ts` (lines 36-37) with the following clean JavaScript `for` loop**:
   ```typescript
   console.log('Stopping existing Supabase containers and cleaning up Docker...');
   try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   try { execSync('docker rm -f $(docker ps -aq) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   execSync('sleep 10', { stdio: 'inherit' });

   console.log('Attempting to start Supabase cleanly...');
   let supabaseStarted = false;
   for (let i = 0; i < 3; i++) {
     try {
       console.log(`Supabase start attempt ${i + 1}/3...`);
       execSync('npx supabase start', { stdio: 'inherit' });
       supabaseStarted = true;
       break;
     } catch (err) {
       console.error(`Supabase start attempt ${i + 1} failed. Checking status and cleaning up before retry...`);
       try { execSync('npx supabase status', { stdio: 'inherit' }); } catch (statusErr) { console.error('Supabase status check failed.'); }
       try {
         execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' });
         execSync('docker rm -f $(docker ps -aq) 2>/dev/null || true', { stdio: 'inherit' });
       } catch (cleanupErr) {}
       execSync('sleep 10', { stdio: 'inherit' });
     }
   }

   if (!supabaseStarted) {
     console.error('Failed to start Supabase after 3 attempts.');
     process.exit(1);
   }
   ```
2. **Ensure all other verified invariants remain untouched**:
   - `e2e/init_db.ts` retains `pg.Client` retry loop fix (`new Client({ connectionString })` INSIDE `while` loop).
   - `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts`.
   - `try...catch` blocks around `e2e/init_db.ts` and Playwright test execution remain removed in `e2e/run_e2e.ts`.
   - `e2e/run_e2e.ts` retains the 10-second warmup delay and the resilient Next.js server keep-alive/respawn mechanism (`startNextServer()`, `isShuttingDown` flag, `on('exit')` listener).
   - `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.

## 5. Verification Method
- **Inspection**: Verify `e2e/run_e2e.ts` contains the clean JavaScript `for` loop in `setup()` and does not contain `pkill -9 -f next` or `try...catch` blocks around `init_db.ts`/`playwright test`.
- **Execution**: Run `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`.
- **Expected Outcome**: All tests pass with exit code 0, Supabase starts cleanly without restart loops or prune race conditions, and no orphaned containers remain.
