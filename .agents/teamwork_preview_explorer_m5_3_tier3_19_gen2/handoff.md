# Handoff Report: Investigation of Challenger 9 FAILURE & Masked Failure Vulnerability (Tier 3 E2E Explorer 19, Iteration 6, Gen 2)

**Work Product**: Investigation and Concrete Fix Strategy for Milestone 5.3 (`supabase/config.toml`, `e2e/run_e2e.ts`, `TEST_READY.md`)
**Profile**: General Project
**Verdict**: FAILURE & VULNERABILITY CONFIRMED (Concrete Fix Strategy Provided for Worker)

## 1. Observation
- **Realtime Contract Violation (`supabase/config.toml`)**:
  - Inspected `supabase/config.toml` (lines 81-82) and observed `[realtime] enabled = false`.
  - Inspected `SCOPE.md` (line 14) which explicitly requires `[realtime] enabled = true in supabase/config.toml`.
- **Persistent `supabase-go` Daemon Corruption (`e2e/run_e2e.ts`)**:
  - Inspected `e2e/run_e2e.ts` (lines 14-25) and observed `teardownSupabase()` executes `pkill -9 -f "supabase-go"` (line 17) BEFORE `docker ps -a -q --filter name=supabase | xargs -r docker rm -f` (line 19).
  - Observed `teardownSupabase()` uses `sleep 5` (line 24) instead of `sleep 20` and lacks the `while docker ps -aq` wait loop.
  - Inspected `SCOPE.md` (line 15) which defines the contract: `Standardized bulletproof teardown sequence across all 9 locations (npx supabase stop, pkill -9 -f supabase, pkill -9 -f supabase-go, pkill -9 -f npx supabase, docker rm -f, docker volume rm -f, while docker ps -aq, fuser -k 25432/tcp, rm -rf supabase/.temp, sleep 20) ensuring pkill executes after docker rm -f to prevent supabase-go daemon corruption.`
  - Inspected Challenger 9's `handoff.md` (lines 11-13) which empirically confirms `Unknown: ChildProcess.exitCode` errors and `supabase start is already running.` collisions resulting from this corruption.
- **Concurrent Process Elimination War (`e2e/run_e2e.ts`)**:
  - Inspected `e2e/run_e2e.ts` (lines 223-238) and observed a global process cleanup mechanism executing `pgrep -f "node.*run_e2e"` and `pgrep -f "tsx.*run_e2e"` followed by `kill -9 ${pids.join(' ')}`.
  - Inspected Challenger 10's `handoff.md` (lines 26-28, 32) which empirically confirms that in a shared multi-tenant/multi-terminal environment (`pts/3`, `pts/4`, `pts/5`), this global `kill -9` causes concurrent test runners to kill each other mid-execution (e.g., while waiting for PostgREST schema cache reload in `init_db.ts`).
- **Masked Failure & Exit Code 0 Vulnerability (`e2e/run_e2e.ts` & `TEST_READY.md`)**:
  - Inspected `TEST_READY.md` (line 4) and observed the master test runner command is invoked via `exec npx tsx e2e/run_e2e.ts`.
  - Inspected Challenger 9's `handoff.md` (lines 14-16) and Challenger 10's `handoff.md` (lines 24, 33) which empirically confirm that when `tsx e2e/run_e2e.ts` is killed with `kill -9` (by another agent's `run_e2e.ts` or during `teardownSupabase()`), `npx` absorbs the SIGKILL/SIGTERM termination and exits with code 0 (`The command completed successfully.`). This completely skips the Next.js build and Playwright tests while falsely reporting a successful test pass.

## 2. Logic Chain
1. **Realtime Contract Violation**: Setting `[realtime] enabled = false` in `supabase/config.toml` disables the Realtime engine, directly violating the `SCOPE.md` contract and causing `http://127.0.0.1:54321/realtime/v1/health` checks in `run_e2e.ts` to fail or timeout in environments where fallback status codes are not met.
2. **Persistent `supabase-go` Daemon Corruption**: The `Unknown: ChildProcess.exitCode` error occurs because the Supabase CLI npm wrapper spawns the `supabase-go` binary, which gets into a corrupted state or clashes with lingering daemon lockfiles/containers (`supabase start is already running.`). Executing `pkill -9 -f "supabase-go"` before `docker rm -f` corrupts the daemon state. Updating `teardownSupabase()` to execute `docker rm -f` before `pkill`, adding the `while docker ps -aq` wait loop, and extending sleep to `sleep 20` ensures a clean reset of the daemon state.
3. **Concurrent Process Elimination War**: The global `pgrep/kill -9` mechanism in `run_e2e.ts` identifies all `node.*run_e2e` and `tsx.*run_e2e` processes on the machine (excluding its own ancestors) and terminates them. In a multi-tenant environment where multiple automated test runners or agent terminals execute concurrently, this creates an adversarial process elimination war where runners kill each other. Replacing this with a file-based mutex lock (`/tmp/run_e2e.lock`) ensures concurrent test runners queue up and execute sequentially without killing each other.
4. **Masked Failure & Exit Code 0 Vulnerability**: `exec npx tsx e2e/run_e2e.ts` replaces the shell process with `npx`, making `npx` the direct parent of `tsx e2e/run_e2e.ts`. When `tsx e2e/run_e2e.ts` is killed with `kill -9`, `npx` sees its child terminate with SIGKILL but exits with code 0. Replacing `exec npx tsx e2e/run_e2e.ts` with `node node_modules/.bin/tsx e2e/run_e2e.ts` prevents `npx` from swallowing SIGKILL exit codes and guarantees that any abnormal termination correctly propagates a non-zero exit code to the calling shell.

## 3. Caveats
- No caveats. All findings were directly observed in the configuration files, test runner scripts, and scope contracts, and corroborated by empirical evidence from previous Challenger and Auditor handoff reports.

## 4. Conclusion
The Challenger 9 FAILURE and Masked Failure Vulnerability are confirmed. The current implementation in `supabase/config.toml`, `e2e/run_e2e.ts`, and `TEST_READY.md` violates `SCOPE.md` contracts, corrupts the `supabase-go` daemon, triggers a concurrent process elimination war, and masks test failures with exit code 0.

### Concrete Fix Strategy for Worker (Milestone 5.3)
The Worker must implement the following 4 concrete fixes:

1. **Fix Realtime Contract (`supabase/config.toml`)**:
   - In `supabase/config.toml`, change `enabled = false` to `enabled = true` under `[realtime]` (line 82).

2. **Fix `supabase-go` Daemon Corruption (`e2e/run_e2e.ts`)**:
   - Rewrite `teardownSupabase()` in `e2e/run_e2e.ts` to strictly follow the `SCOPE.md` contract (`docker rm -f` before `pkill`, `while docker ps -aq` wait loop, `sleep 20`):
     ```typescript
     function teardownSupabase() {
       console.log('Performing bulletproof Supabase teardown and cleanup...');
       try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try {
         let retries = 10;
         while (retries > 0) {
           const count = execSync('docker ps -aq --filter name=supabase 2>/dev/null || true', { encoding: 'utf-8' }).trim();
           if (!count) break;
           execSync('sleep 1', { stdio: 'inherit' });
           retries--;
         }
       } catch(e){}
       try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('rm -rf supabase/.temp /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
     }
     ```

3. **Fix Concurrent Process Elimination War (`e2e/run_e2e.ts`)**:
   - Replace the global `pgrep/kill -9` mechanism in `setup()` and before `npm run build` with a file-based mutex lock (`/tmp/run_e2e.lock`) to ensure concurrent test runners queue up and execute sequentially:
     ```typescript
     // In setup():
     const lockPath = '/tmp/run_e2e.lock';
     let lockAcquired = false;
     while (!lockAcquired) {
       try {
         const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY);
         fs.writeSync(fd, `${process.pid}`);
         fs.closeSync(fd);
         lockAcquired = true;
         console.log(`Acquired e2e mutex lock (${lockPath}) for PID ${process.pid}`);
       } catch (e) {
         console.log(`Another run_e2e process is currently executing. Waiting for mutex lock (${lockPath})...`);
         execSync('sleep 5', { stdio: 'inherit' });
       }
     }
     
     // In cleanup():
     if (lockAcquired && fs.existsSync(lockPath)) {
       try { fs.unlinkSync(lockPath); console.log(`Released e2e mutex lock (${lockPath})`); } catch(e){}
     }
     ```

4. **Fix Masked Failure Vulnerability (`TEST_READY.md`)**:
   - In `TEST_READY.md`, replace `exec npx tsx e2e/run_e2e.ts` with `node node_modules/.bin/tsx e2e/run_e2e.ts` to prevent `npx` from swallowing SIGKILL/SIGTERM exit codes.

## 5. Verification Method
To independently verify the findings and validate the fix strategy once implemented by the Worker:

1. **Inspect `supabase/config.toml`**:
   Verify `[realtime]` has `enabled = true`.

2. **Inspect `e2e/run_e2e.ts`**:
   Verify `teardownSupabase()` executes `docker rm -f` before `pkill`, includes the `while docker ps -aq` wait loop, and ends with `sleep 20`. Verify `setup()` implements the file-based mutex lock (`/tmp/run_e2e.lock`) and removes global `pgrep/kill -9`.

3. **Inspect `TEST_READY.md`**:
   Verify the master test runner command uses `node node_modules/.bin/tsx e2e/run_e2e.ts`.

4. **Execute Master E2E Test Runner**:
   Run the updated command defined in `TEST_READY.md`:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
   **Expected Result**: All standalone verification scripts and `node node_modules/.bin/tsx e2e/run_e2e.ts` will execute successfully, start Supabase cleanly without daemon corruption, queue up properly if run concurrently without killing each other, pass 100% of Playwright E2E tests, and terminate with exit code 0.
