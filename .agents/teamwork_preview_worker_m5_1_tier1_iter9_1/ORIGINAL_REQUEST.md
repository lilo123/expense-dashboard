## 2026-07-04T11:09:31Z

You are the Worker (Iteration 9) for Milestone 5.1 (Tier 1 E2E Test Pass - Feature Coverage).
Your working directory is `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_tier1_iter9_1`.
Your identity/role is `teamwork_preview_worker`.

Load the Jetski skill at:
  `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/software_engineering/SKILL.md`

Read `PROJECT.md`, `.agents/sub_orch_m5_1_tier1/SCOPE.md`, `TEST_READY.md`, `.agents/ORIGINAL_REQUEST.md`, and the Explorer's handoff report at `.agents/teamwork_preview_explorer_m5_1_tier1_iter9_3/handoff.md`.

### Milestone Description & Explorer Findings
The previous iteration failed due to Supabase CLI daemon locks (`supabase start is already running.`), Docker daemon prune race conditions (`a prune operation is already running`), and Event Loop Blocking by synchronous `execSync('npx playwright test ...')`. When `execSync` is used, it blocks the Node.js event loop, preventing `nextServer.on('exit')` from respawning the Next.js server when it crashes during long test runs (around test 30), causing `net::ERR_CONNECTION_REFUSED`. Furthermore, removing `--ignore-health-check` caused Supabase CLI to fail during container health inspection, leaving lingering daemon locks.
Explorer 3 has provided the exact, bulletproof code replacements for `e2e/run_e2e.ts`.

### Tasks
1. Implement the exact code replacements in `e2e/run_e2e.ts` recommended by Explorer 3 in its handoff report:
   - In `setup()` in `e2e/run_e2e.ts`, restore `--ignore-health-check` in `npx supabase start` AND explicitly kill any lingering Supabase CLI daemon processes (`pkill -f supabase` or `fuser -k 54321/tcp 54322/tcp 2>/dev/null || true`) before each retry in the `for` loop to eliminate `supabase start is already running.` daemon locks:
     ```typescript
     console.log('Stopping existing Supabase containers and cleaning up Docker...');
     try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('docker rm -f $(docker ps -aq) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('pkill -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('fuser -k 54321/tcp 54322/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     execSync('sleep 10', { stdio: 'inherit' });

     console.log('Attempting to start Supabase cleanly...');
     let supabaseStarted = false;
     for (let i = 0; i < 3; i++) {
       try {
         console.log(`Supabase start attempt ${i + 1}/3...`);
         execSync('npx supabase start --ignore-health-check', { stdio: 'inherit' });
         supabaseStarted = true;
         break;
       } catch (err) {
         console.error(`Supabase start attempt ${i + 1} failed. Checking status and cleaning up before retry...`);
         try { execSync('npx supabase status', { stdio: 'inherit' }); } catch (statusErr) { console.error('Supabase status check failed.'); }
         try {
           execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' });
           execSync('docker rm -f $(docker ps -aq) 2>/dev/null || true', { stdio: 'inherit' });
           execSync('pkill -f supabase 2>/dev/null || true', { stdio: 'inherit' });
           execSync('fuser -k 54321/tcp 54322/tcp 2>/dev/null || true', { stdio: 'inherit' });
         } catch (cleanupErr) {}
         execSync('sleep 10', { stdio: 'inherit' });
       }
     }

     if (!supabaseStarted) {
       console.error('Failed to start Supabase after 3 attempts.');
       process.exit(1);
     }
     ```
   - In `run()` in `e2e/run_e2e.ts`, replace `execSync('npx playwright test --workers=1 --reporter=list', { stdio: 'inherit' });` with an asynchronous execution using `child_process.spawn` wrapped in a Promise so the Node.js event loop remains active to process `nextServer.on('exit')` events and successfully respawn the Next.js server during long test runs:
     ```typescript
     console.log('Launching Playwright E2E tests across all browsers sequentially (asynchronously to preserve event loop)...');
     await new Promise((resolve, reject) => {
       const pw = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list'], { stdio: 'inherit' });
       pw.on('close', (code: number) => {
         if (code === 0) {
           resolve(true);
         } else {
           reject(new Error(`Playwright tests failed with exit code ${code}`));
         }
       });
     });
     ```
2. Ensure `e2e/init_db.ts` retains the `pg.Client` retry loop fix (instantiating `new Client({ connectionString })` INSIDE the `while` loop on each attempt).
3. Ensure `fuser -k 3000/tcp` remains in place (no `pkill -9 -f next`) to prevent process suicide.
4. Ensure `execSync('npx tsx e2e/init_db.ts', ...)` remains without a `try...catch` block to ensure database permissions and RLS disablement are applied genuinely.
5. Ensure `e2e/run_e2e.ts` retains the 10-second warmup delay before Playwright tests and the resilient Next.js server keep-alive/respawn mechanism (`startNextServer()`, `isShuttingDown` flag, `on('exit')` listener).
6. Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.
7. Execute the prerequisite process cleanup command to terminate all orphaned test runners and fully prune all containers:
   `fuser -k 3000/tcp 54321/tcp 54322/tcp 2>/dev/null || true && docker rm -f $(docker ps -aq) 2>/dev/null || true`
8. Run the full test runner command specified in `TEST_READY.md`:
   `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`
9. If any tests fail, investigate and implement the necessary fixes in the codebase, then re-verify until all tests pass successfully with exit code 0.
10. Document your commands, changes, and passing test results in `handoff.md` in your working directory, and send a completion message to me.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
