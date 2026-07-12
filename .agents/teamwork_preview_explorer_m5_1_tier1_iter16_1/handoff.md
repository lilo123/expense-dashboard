# M5.1 Tier 1 Explorer 1 (Iteration 16) Handoff Report

## 1. Observation
- **E2E Test Runner Failure Analysis (`e2e/run_e2e.ts`)**:
  - During the previous iteration (Iteration 15), `npx tsx e2e/run_e2e.ts` failed with exit code 1 due to Supabase Docker container startup instability (`Unknown: ChildProcess.exitCode`, `supabase start is already running`, `unexpected EOF At statement: 0 alter default privileges`) and Docker daemon container removal race conditions (`removal of container ... is already in progress`, `a prune operation is already running`).
  - Inspection of `e2e/run_e2e.ts` reveals six distinct places where Supabase containers are stopped and cleaned up: lines 37-43 (initial setup), lines 50-57 (setup retry loop), lines 85-91 (setup catch block), lines 149-155 (`run()` health check retry loop), lines 207-213 (`run()` pre-seed health check retry loop), and lines 268-274 (`run()` post-build health check retry loop).
  - In all six locations, the teardown sequence executes `docker ps -aq | xargs -r docker rm -f` immediately followed by `docker volume ls -q | xargs -r docker volume rm -f`.
  - This synchronous `docker rm -f` collides with the Docker daemon's background container teardown (`removal of container ... is already in progress`). This leaves lingering container locks that cause `supabase-go` to fail with `Unknown: ChildProcess.exitCode` or falsely report `supabase start is already running` while leaving the Kong API gateway stopped.
- **Forensic Integrity & Retained Requirements Verification**:
  - `e2e/run_e2e.ts`: Confirmed `setup()` is `async`, includes robust HTTP reachability verification (`await fetch('http://127.0.0.1:54321')`), retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration. Confirmed `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) to prevent process suicide, `fuser -k 54321/tcp` remains removed to prevent socket inheritance process suicides, and `execSync('npx tsx e2e/init_db.ts')` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
  - `e2e/seed.ts`: Confirmed retention of `schemaRetries = 50` (lines 89-103) and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop (line 203).
  - `e2e/init_db.ts`: Confirmed retention of the 10s post-notification delay (`setTimeout(resolve, 10000)` at lines 85-86).
  - `next.config.js`: Confirmed retention of `outputFileTracing: false` (line 3).
  - `src/lib/planner/*.ts` & `supabase/migrations/20260624000000_retirement_planner.sql`: Confirmed genuine implementations with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers (`check_premium_simulation_range`).

## 2. Logic Chain
1. **Root Cause of Supabase Startup Instability**:
   - Because `docker ps -aq | xargs -r docker rm -f` is executed without waiting for the Docker daemon to fully release container locks, subsequent commands like `docker volume rm -f` and `npx supabase start` encounter race conditions (`removal of container ... is already in progress`, `a prune operation is already running`).
   - When `npx supabase start` encounters these lingering locks, `supabase-go` either crashes (`Unknown: ChildProcess.exitCode`) or detects a partially surviving database container and exits immediately with `supabase start is already running`. This leaves essential microservices like `supabase_kong_expense-dashboard` stopped, causing the reachability check `await fetch('http://127.0.0.1:54321')` to fail and exhaust all retries.
2. **Formulation of the Fix Strategy**:
   - To eliminate the race condition, `e2e/run_e2e.ts` must be updated to include a robust, synchronous teardown that actively waits for all containers to disappear before proceeding to volume removal or starting Supabase.
   - Inserting `try { execSync('while docker ps -aq | grep -q .; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}` immediately after `docker rm -f` guarantees that the Docker daemon has fully purged all containers and released all locks.
   - This exact synchronous waiting loop must be applied across all six teardown blocks in `e2e/run_e2e.ts` (initial setup, setup retry loop, setup catch block, and the three health check restart recovery blocks in `run()`).
   - All other existing architectural requirements, BOLA defenses, RLS policies, and delay mechanisms must be strictly preserved to maintain full feature coverage and forensic integrity.

## 3. Caveats
- No caveats. The investigation comprehensively covered all E2E test runner scripts, database initialization files, Supabase configurations, Next.js configurations, and planner domain logic.

## 4. Conclusion
**Verdict**: E2E TEST RUNNER REQUIRES SYNCHRONOUS DOCKER TEARDOWN FIX

Worker 1 in Iteration 16 must update `e2e/run_e2e.ts` to implement a robust, synchronous teardown that actively waits for containers to disappear across all six teardown blocks.

### Recommended Implementation Plan for Worker 1
1. **Modify `e2e/run_e2e.ts`**:
   - In all six teardown blocks (lines 37-43, 50-57, 85-91, 149-155, 207-213, 268-274), replace the existing teardown sequence with the following exact code:
     ```typescript
     try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('while docker ps -aq | grep -q .; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
     try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('pkill -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('fuser -k 25432/tcp 54329/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('rm -rf supabase/.temp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
     try { execSync('sleep 15', { stdio: 'inherit' }); } catch(e){}
     ```
2. **Ensure Retention of All Existing Guardrails & Requirements**:
   - Ensure `e2e/run_e2e.ts` retains `npx supabase migration up --include-all` (non-interactive), `NODE_OPTIONS: ''` sanitization, precise lingering process cleanup (`node.*run_e2e`, `tsx.*run_e2e`) with grandparent PID filtering, `fuser -k 3000/tcp`, `rm -rf supabase/.temp`, asynchronous `child_process.spawn` for Playwright tests, `sleep 10` decoupling, warmup delays, Next.js keep-alive/respawn mechanism, port `25432` migration, and `async setup()`.
   - Ensure `pkill -9 -f next` remains removed (replaced by `fuser -k 3000/tcp`) in `e2e/run_e2e.ts` to prevent process suicide.
   - Ensure `fuser -k 54321/tcp` remains removed from `e2e/run_e2e.ts` to prevent socket inheritance process suicides.
   - Ensure `execSync('npx tsx e2e/init_db.ts', ...)` and Playwright test execution remain without `try...catch` blocks to ensure genuine error propagation.
   - Ensure `e2e/seed.ts` retains `schemaRetries = 50` and `execSync('npx tsx e2e/init_db.ts')` inside the category fetching loop.
   - Ensure `e2e/init_db.ts` retains the 10s post-notification delay (`setTimeout(resolve, 10000)`).
   - Ensure `next.config.js` retains `outputFileTracing: false`.
   - Ensure `src/lib/planner/*.ts` and `supabase/migrations/20260624000000_retirement_planner.sql` remain genuinely implemented with strict RLS (`auth.uid() = user_id`) and Premium tier check triggers.

## 5. Verification Method
- **Independent Verification Commands**:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
  npx tsc --noEmit
  npm run test __tests__/planner
  npx tsx e2e/run_e2e.ts
  npx tsx e2e/verify_accumulation.ts
  npx tsx e2e/verify_monte_carlo.ts
  ```
- **Expected Outcome**: All commands must complete successfully with exit code 0, confirming bulletproof Supabase startup, zero race conditions, and 100% passing tests across all tiers.
