# Handoff Report — Milestone 5.1 Explorer 1 (Iteration 9)

## 1. Observation
- **E2E Test Runner (`e2e/run_e2e.ts`)**:
  - **Supabase Startup & Retry Loop (`e2e/run_e2e.ts:43-58`)**:
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
    `npx supabase start` lacks `--ignore-health-check`. In the catch block, it attempts `npx supabase stop --no-backup` and `docker rm -f`, but does NOT explicitly kill lingering Supabase CLI daemon processes (`pkill -f supabase` or `fuser -k 54321/tcp 54322/tcp 2>/dev/null || true`).
  - **Playwright Test Execution (`e2e/run_e2e.ts:205-209`)**:
    ```typescript
    console.log('Allowing Next.js and Supabase services 10 seconds to fully stabilize...');
    execSync('sleep 10', { stdio: 'inherit' });
    console.log('Launching Playwright E2E tests across all browsers sequentially...');
    execSync('npx playwright test --workers=1 --reporter=list', { stdio: 'inherit' });
    ```
    `execSync` is invoked synchronously, blocking the Node.js event loop.
  - **Next.js Server Keep-Alive/Respawn (`e2e/run_e2e.ts:159-182`)**:
    The resilient Next.js server keep-alive/respawn mechanism (`startNextServer()`, `isShuttingDown` flag, `on('exit')` listener) is present.
  - **Process Suicide Prevention (`e2e/run_e2e.ts:34, 69, 128, 156, 177`)**:
    `pkill -9 -f next` remains removed and replaced by `fuser -k 3000/tcp`.
  - **Genuine Error Propagation (`e2e/run_e2e.ts:120-124, 205-209`)**:
    `try...catch` blocks around `e2e/init_db.ts` and Playwright test execution remain removed.

- **Database Initializer (`e2e/init_db.ts:11-27`)**:
  ```typescript
  while (retries > 0 && !connected) {
    const c = new Client({ connectionString });
    try {
      await c.connect();
  ```
  `e2e/init_db.ts` retains the `pg.Client` retry loop fix, instantiating `new Client({ connectionString })` INSIDE the `while` loop on each attempt.

- **Domain Logic & Migrations (`src/lib/planner/*.ts`, `supabase/migrations/20260624000000_retirement_planner.sql`)**:
  - `src/lib/planner/types.ts`, `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, `drawdownEngine.ts`, `simulator.ts` remain genuinely implemented with Zod schemas and pure TypeScript business logic engines.
  - `supabase/migrations/20260624000000_retirement_planner.sql` remains genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers (`check_premium_simulation_range`).

## 2. Logic Chain
1. **Supabase Start Lock Corruption & Prune Collision**:
   Without `--ignore-health-check`, `npx supabase start` fails health checks if containers initialize slowly, leaving behind active container initialization processes and lock files. When Attempt 1 fails mid-initialization, subsequent loop iterations attempt `npx supabase stop --no-backup` and `docker rm -f`, but fail to cleanly terminate the background Supabase CLI daemon processes because `pkill -f supabase` or `fuser -k 54321/tcp 54322/tcp` is missing. This causes Attempts 2 and 3 to immediately abort with `supabase start is already running.` and `supabase_db_expense-dashboard container is not ready: starting`. Furthermore, `npx supabase start` triggers an internal Docker prune operation that collides with either the preceding `docker rm -f` cleanup or background Docker daemon operations (`a prune operation is already running`).
2. **Event Loop Blocking via Synchronous `execSync`**:
   `execSync('npx playwright test ...')` is invoked synchronously, completely blocking the Node.js event loop for the entire duration of the Playwright test suite (45 tests). Consequently, if the detached `nextServer` process crashes during a long test run, the asynchronous `nextServer.on('exit', ...)` event listener cannot be scheduled or executed by the Node.js event loop until after `execSync` completes—by which time Playwright has already failed with `net::ERR_CONNECTION_REFUSED`.

## 3. Caveats
- No caveats. All identified failure modes from Iteration 8 were successfully traced to explicit lines in `e2e/run_e2e.ts`, and all required stability safeguards in `e2e/init_db.ts`, `src/lib/planner/*.ts`, and Supabase migrations were verified to be intact.

## 4. Conclusion
`e2e/run_e2e.ts` suffers from Supabase container start/prune race conditions (`a prune operation is already running`, `supabase start is already running.`) and retains the synchronous `execSync('npx playwright test ...')` call which blocks the Node.js event loop and breaks the Next.js server respawn mechanism. 

### Recommended Fix Strategy (for Worker)
1. **Restore `--ignore-health-check` & Explicit Daemon Cleanup in `setup()` (`e2e/run_e2e.ts:43-58`)**:
   ```typescript
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
         execSync('pkill -f supabase 2>/dev/null || true', { stdio: 'inherit' });
         execSync('fuser -k 54321/tcp 54322/tcp 2>/dev/null || true', { stdio: 'inherit' });
         execSync('docker rm -f $(docker ps -aq) 2>/dev/null || true', { stdio: 'inherit' });
       } catch (cleanupErr) {}
       execSync('sleep 10', { stdio: 'inherit' });
     }
   }
   ```
2. **Replace Synchronous `execSync` with Asynchronous `spawn` in `run()` (`e2e/run_e2e.ts:208`)**:
   ```typescript
   console.log('Launching Playwright E2E tests across all browsers sequentially...');
   await new Promise((resolve, reject) => {
     const pw = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list'], { stdio: 'inherit' });
     pw.on('close', (code: number) => {
       if (code === 0) resolve(true);
       else reject(new Error(`Playwright tests failed with exit code ${code}`));
     });
   });
   ```

## 5. Verification Method
- **Files to Inspect**:
  - `e2e/run_e2e.ts`: Verify `npx supabase start --ignore-health-check`, `pkill -f supabase`, `fuser -k 54321/tcp 54322/tcp`, and asynchronous `spawn('npx', ['playwright', ...])` wrapped in a Promise are correctly implemented.
  - `e2e/init_db.ts`: Verify `new Client({ connectionString })` remains inside the `while` loop.
- **Commands to Execute**:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts
  ```
  Expected result: All 45 E2E tests pass successfully with exit code 0, with zero Supabase daemon lock errors or event loop blocking issues.
