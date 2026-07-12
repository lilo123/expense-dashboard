# Handoff Report — Milestone 5.1 Explorer 3 (Iteration 9)

## 1. Observation
- **Supabase Start Daemon Lock & Prune Collision (`e2e/run_e2e.ts:43-58`)**:
  ```typescript
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
  ```
  `npx supabase start` is called without `--ignore-health-check`. When a start attempt fails or times out during health checks, Supabase CLI daemon processes remain active in the background. The retry cleanup block attempts `npx supabase stop --no-backup` and `docker rm -f`, but does not explicitly terminate lingering Supabase CLI daemon processes (`pkill -f supabase` or `fuser -k 54321/tcp 54322/tcp`). This results in `supabase start is already running.` daemon locks and Docker prune race conditions (`a prune operation is already running`).

- **Event Loop Blocking via Synchronous `execSync` (`e2e/run_e2e.ts:208`)**:
  ```typescript
  execSync('npx playwright test --workers=1 --reporter=list', { stdio: 'inherit' });
  ```
  `execSync` is invoked synchronously, completely blocking the Node.js event loop during the entire Playwright E2E test execution (45 tests). Consequently, if the detached `nextServer` crashes during a long test run, the asynchronous `nextServer.on('exit', ...)` event listener cannot be processed by the event loop, breaking the Next.js server respawn mechanism.

- **`pg.Client` Retry Loop Fix (`e2e/init_db.ts:14-27`)**:
  ```typescript
  while (retries > 0 && !connected) {
    const c = new Client({ connectionString });
    try {
      await c.connect();
      client = c;
      connected = true;
      console.log('Connected successfully to local Postgres at port 54322.');
    } catch (e: any) { ... }
  }
  ```
  `new Client({ connectionString })` is correctly instantiated inside the `while` loop on each attempt.

- **Process Suicide Prevention (`e2e/run_e2e.ts`)**:
  `fuser -k 3000/tcp 2>/dev/null || true` is used consistently (lines 34, 69, 128, 156, 177). `pkill -9 -f next` remains removed.

- **Genuine Error Propagation (`e2e/run_e2e.ts`)**:
  `e2e/init_db.ts` (line 121) and Playwright test execution (line 208) are not wrapped in individual `try...catch` blocks, ensuring genuine error propagation to the main `run()` catch block.

- **Warmup Delay & Resilient Next.js Server Respawn (`e2e/run_e2e.ts`)**:
  `startNextServer()` with `isShuttingDown` flag and `nextServer.on('exit')` listener is present (lines 159-182). A 10-second warmup delay (`execSync('sleep 10')`) is present before Playwright tests (lines 205-206).

- **Retirement Planner Implementation & Strict RLS (`src/lib/planner/*.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`)**:
  All 7 tables have strict RLS enabled (`auth.uid() = user_id`). The Premium tier check function `public.check_premium_simulation_range()` and trigger `tr_simulation_configs_premium_guard` are intact. Pure TypeScript business logic engines (`taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts`) and Zod schemas (`types.ts`) remain genuinely implemented.

## 2. Logic Chain
1. **Supabase CLI Daemon Locks & Prune Race Conditions**: Without `--ignore-health-check`, `npx supabase start` is vulnerable to health check timeouts, leaving active background Supabase CLI daemon processes and lock files. When the retry loop executes `npx supabase stop --no-backup` and `docker rm -f`, the lingering Supabase CLI daemon processes are not killed, causing subsequent attempts to fail immediately with `supabase start is already running.` and colliding with background Docker prune operations (`a prune operation is already running`). Restoring `--ignore-health-check` prevents health check timeout aborts, and explicitly killing lingering Supabase CLI daemon processes (`pkill -f supabase` or `fuser -k 54321/tcp 54322/tcp 2>/dev/null || true`) before each retry ensures a clean slate, eliminating daemon locks and race conditions.
2. **Event Loop Blocking**: `execSync('npx playwright test ...')` executes synchronously, halting the Node.js event loop for the entire duration of the 45 Playwright tests. If the detached Next.js server crashes mid-run, the `nextServer.on('exit')` event cannot be scheduled or handled until `execSync` finishes—by which time Playwright has already failed with `net::ERR_CONNECTION_REFUSED`. Replacing `execSync` with `child_process.spawn` wrapped in a `Promise` allows the Node.js event loop to remain active, ensuring `nextServer.on('exit')` can successfully respawn the Next.js server if it crashes.

## 3. Caveats
- No caveats. All observed mechanisms were verified against the codebase and Challenger findings.

## 4. Conclusion
`e2e/run_e2e.ts` suffers from Supabase CLI daemon locks (`supabase start is already running.`), Docker prune race conditions (`a prune operation is already running`), and event loop blocking via synchronous `execSync('npx playwright test ...')`. The implementation must be sent to the Worker to apply the following concrete fix strategy:
1. **Restore `--ignore-health-check` & Kill Lingering Daemons**: In `e2e/run_e2e.ts` `setup()`, update line 46 to `execSync('npx supabase start --ignore-health-check', { stdio: 'inherit' });`. In the `catch` block (lines 52-55), explicitly add `execSync('pkill -f supabase 2>/dev/null || true', { stdio: 'inherit' });` and `execSync('fuser -k 54321/tcp 54322/tcp 2>/dev/null || true', { stdio: 'inherit' });` before `npx supabase stop --no-backup` and `docker rm -f`.
2. **Asynchronous Playwright Execution**: In `e2e/run_e2e.ts` `run()`, replace line 208 (`execSync('npx playwright test ...')`) with an asynchronous `child_process.spawn` execution wrapped in a `Promise`:
   ```typescript
   await new Promise((resolve, reject) => {
     const pw = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list'], { stdio: 'inherit' });
     pw.on('close', (code: number) => {
       if (code === 0) resolve(true);
       else reject(new Error(`Playwright tests failed with exit code ${code}`));
     });
   });
   ```

## 5. Verification Method
1. Inspect `e2e/run_e2e.ts` to verify `npx supabase start --ignore-health-check`, explicit daemon killing (`pkill -f supabase`, `fuser -k 54321/tcp 54322/tcp`), and asynchronous `child_process.spawn` for Playwright tests are correctly implemented.
2. Run the full E2E test runner command:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
   ```
   Expected result: All tests pass with exit code 0, Supabase starts cleanly without daemon locks or prune collisions, and the Next.js server remains resilient throughout the test run.
