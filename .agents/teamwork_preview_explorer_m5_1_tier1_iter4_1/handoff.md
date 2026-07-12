# Handoff Report: Milestone 5.1 Tier 1 E2E Test Pass (Feature Coverage) - Explorer 1 (Iteration 4)

## 1. Observation
- **Reviewer 1 (Iter 3) Findings**: Identified Supabase connection refusals (`connect ECONNREFUSED 127.0.0.1:54321`) during `e2e/run_e2e.ts`. Specifically, `rm -rf supabase/.temp ~/.supabase /tmp/supabase*` purged Supabase CLI internal state (API gateway configurations/credentials), `npx supabase start --ignore-health-check` bypassed service initialization checks, and subsequent `docker start` commands forcibly started containers without respecting dependency startup order (DB -> Auth/Rest -> Kong), causing Kong to fail to bind or crash.
- **File Inspection (`e2e/run_e2e.ts`)**:
  - Lines 35-39 in `setup()` currently execute:
    ```typescript
    try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker rm -f $(docker ps -aq) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('rm -rf supabase/.temp ~/.supabase /tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('npx supabase start --ignore-health-check 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker start supabase_db_expense-dashboard supabase_rest_expense-dashboard supabase_auth_expense-dashboard supabase_kong_expense-dashboard $(docker ps -aq --filter name=supabase 2>/dev/null) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    ```
  - Lines 107-109 and 115-116 in `run()` execute `docker stop` and `docker start` on Supabase containers around `npm run build`:
    ```typescript
    console.log('Temporarily stopping Supabase containers to free up memory for Next.js build...');
    try { execSync('docker stop supabase_db_expense-dashboard supabase_rest_expense-dashboard supabase_auth_expense-dashboard supabase_kong_expense-dashboard $(docker ps -aq --filter name=supabase 2>/dev/null) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    // ... build ...
    console.log('Restarting Supabase containers after build...');
    try { execSync('docker start supabase_db_expense-dashboard supabase_rest_expense-dashboard supabase_auth_expense-dashboard supabase_kong_expense-dashboard $(docker ps -aq --filter name=supabase 2>/dev/null) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    ```
  - Lines 33, 45, 111, and 141 correctly utilize `fuser -k 3000/tcp` instead of `pkill -9 -f next`.
  - Lines 177-178 execute Playwright without a wrapping `try...catch` block:
    ```typescript
    console.log('Launching Playwright E2E tests across all browsers sequentially...');
    execSync('npx playwright test --workers=1 --reporter=list', { stdio: 'inherit' });
    ```
- **E2E Test Suite Inspection (`e2e/*.spec.ts`, `e2e/verify_*.ts`)**:
  - `e2e/verify_accumulation.ts` and `e2e/verify_monte_carlo.ts` correctly import worker logic and validate R1, R2, R3 simulation contracts.
  - Playwright test files (`auth.spec.ts`, `dashboard.spec.ts`, `settings.spec.ts`, etc.) are configured to run sequentially (`--workers=1`) against `http://localhost:3000` and rely on a stable Supabase API gateway at `http://127.0.0.1:54321`.

## 2. Logic Chain
1. **Supabase Connection Refusal & Gateway Corruption**:
   - The inclusion of `rm -rf supabase/.temp` destroys the generated API gateway configuration files required by Kong.
   - The `--ignore-health-check` flag allows the script to proceed before Kong, Auth, and Rest are fully wired to the database.
   - Using raw `docker start` commands ignores container start dependencies. Kong requires Auth and Rest to be ready, which in turn require DB to be ready. Forcibly starting them simultaneously causes Kong to fail to bind or crash, resulting in `ECONNREFUSED 127.0.0.1:54321`.
2. **Eliminating Container Lifecycle Thrashing**:
   - By combining `npx supabase stop --no-backup`, `docker rm -f $(docker ps -aq)`, and `npx supabase start` (without `rm -rf supabase/.temp` and without `--ignore-health-check`), we ensure a clean container slate while preserving gateway configs and letting the Supabase CLI manage health checks and dependency startup order.
   - Removing the raw `docker stop` and `docker start` commands around `npm run build` prevents breaking the Kong gateway post-build.
3. **Process Management & Error Propagation**:
   - `fuser -k 3000/tcp` successfully prevents process suicide (which `pkill -9 -f next` previously caused by killing the test runner itself).
   - Leaving `execSync('npx playwright test ...')` without a `try...catch` block ensures that any genuine Playwright test failure correctly bubbles up to the main `catch` block in `run()`, setting `process.exitCode = 1`.
4. **Underlying E2E Test Verification**:
   - With Playwright running genuinely and sequentially (`--workers=1`), the primary risk to the E2E tests is backend gateway instability. Ensuring Supabase remains continuously healthy eliminates flaky API calls during test execution.

## 3. Caveats
- **Read-Only Investigation**: As an explorer agent, no code changes were directly executed or tested in this turn. The recommended fix strategy must be applied by the subsequent Worker agent.
- **Resource Constraints**: It is assumed the host environment has sufficient memory to keep Supabase containers running during `npm run build`. If memory is strictly constrained, `npx supabase stop` and `npx supabase start` should be used instead of raw `docker stop`/`docker start`.

## 4. Conclusion
- **[Critical] Finding 1: Supabase Gateway Corruption & Dependency Order Violations**: The combination of `rm -rf supabase/.temp`, `--ignore-health-check`, and raw `docker start` commands breaks the Kong API gateway, causing `ECONNREFUSED`.
- **Recommended Fix Strategy**:
  1. In `e2e/run_e2e.ts`, replace lines 35-39 in `setup()` with:
     ```typescript
     try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('docker rm -f $(docker ps -aq) 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('npx supabase start 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     ```
  2. In `e2e/run_e2e.ts`, remove the raw `docker start` at line 88 and line 103, and remove the `docker stop`/`docker start` block around `npm run build` (lines 108 and 116) to maintain a stable, uninterrupted Supabase gateway.
  3. Ensure `fuser -k 3000/tcp` remains in place (no `pkill -9 -f next`).
  4. Ensure `execSync('npx playwright test ...')` remains without a `try...catch` block to guarantee genuine error propagation.

## 5. Verification Method
- **Inspection**: Verify `e2e/run_e2e.ts` contains the exact recommended `setup()` sequence and no instances of `rm -rf supabase/.temp`, `--ignore-health-check`, `docker start`, or `pkill -9 -f next`.
- **Execution**: Run the full E2E test suite command:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
  ```
- **Expected Outcome**: All commands complete with exit code 0, Supabase initializes successfully without connection refusals, and Playwright tests pass genuinely.
