# Handoff Report: Milestone 5.3 Verification Swarm Failure Analysis & Concrete Fix Strategy (Tier 3 E2E Explorer 18)

**Work Product**: Analysis of Verification Swarm Feedback (Iteration 5) and Concrete Fix Strategy for Milestone 5.3 (`supabase/config.toml`, `e2e/run_e2e.ts`, `TEST_READY.md`)
**Profile**: General Project / Read-Only Investigation
**Verdict**: FIX STRATEGY FORMULATED (Addresses Realtime Contract Violation, Daemon Corruption, Concurrent Process Elimination Wars, and Masked Failure Vulnerabilities)

## 1. Observation
- **Realtime Contract Violation (`supabase/config.toml`)**:
  - `SCOPE.md` (lines 13-14) explicitly requires: `[realtime] enabled = true in supabase/config.toml; explicit health check loop for http://127.0.0.1:54321/realtime/v1/health`.
  - Observed `supabase/config.toml` (lines 81-82) contains:
    ```toml
    [realtime]
    enabled = false
    ```
  - Verification Swarm Challenger 9 reported this causes Realtime health check timeouts and violates the Milestone 5.3 contract.

- **Unresolved `supabase-go` Daemon Corruption (`e2e/run_e2e.ts`)**:
  - `SCOPE.md` (line 15) requires a `Standardized bulletproof teardown sequence... ensuring pkill executes after docker rm -f to prevent supabase-go daemon corruption.`
  - Observed `e2e/run_e2e.ts` (`teardownSupabase()`, lines 14-26) executes `pkill -9 -f "supabase-go"` (line 19) BEFORE `docker ps -a -q --filter name=supabase | xargs -r docker rm -f` (line 21).
  - Verification Swarm Challenger 9 observed `npx supabase start` and `npx supabase db reset` consistently fail with `Unknown: ChildProcess.exitCode (.../bin/supabase-go --output json --debug start)` and collide with `supabase start is already running.` / `supabase_db_expense-dashboard container is not ready: starting`.

- **Concurrent Process Elimination War (`e2e/run_e2e.ts`)**:
  - Observed `e2e/run_e2e.ts` implements lingering process cleanup before build (lines 249-283) and post-build (lines 290-313) using global `pgrep -f "node.*run_e2e"`, `pgrep -f "tsx.*run_e2e"`, and `pgrep -f "node|tsx|jest|webpack"`, filtering out only its own ancestor PIDs (`ancestorPids.has(pid)`).
  - Verification Swarm Challenger 10 observed that in a shared environment where multiple automated test runners or agent terminals (`pts/3`, `pts/4`, `pts/5`, `task-20`) execute concurrently, this global `kill -9` creates an adversarial "process elimination war". `task-20` killed existing `run_e2e` processes, but ~30 seconds later while waiting in `init_db.ts`, another terminal started `run_e2e.ts` and abruptly killed `task-20`'s process with `kill -9`.

- **Masked Failure Vulnerability (`TEST_READY.md` & `e2e/run_e2e.ts`)**:
  - Observed `TEST_READY.md` (line 4) defines the test runner invocation string as:
    ```bash
    export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
    ```
  - Verification Swarm Challengers 9 & 10 observed that `exec npx tsx e2e/run_e2e.ts` replaces the shell process with `npx`, making `npx` the direct parent of `tsx e2e/run_e2e.ts`. When `tsx e2e/run_e2e.ts` is killed with `kill -9` (by another agent or during teardown), `npx` absorbs the SIGKILL/SIGTERM without propagating the error and exits with code 0 (`The command completed successfully.`). This completely skips the Next.js build and Playwright tests while falsely reporting success.

- **Clean Audit & Approvals**:
  - Verification Swarm Forensic Auditor 5 confirmed zero hardcoded test results, zero facade implementations, zero fabricated logs, zero unauthorized git pushes.
  - Verification Swarm Reviewers 9 & 10 confirmed `outputFileTracing: false` in `next.config.js`, `NODE_OPTIONS: ''` sanitization, `docker rm -f` before `pkill` (intended contract), and explicit `process.exit(1)`.

## 2. Logic Chain
1. **Realtime Contract Violation**: Setting `[realtime] enabled = false` in `supabase/config.toml` disables the Realtime engine. This directly violates the `SCOPE.md` contract and causes the `http://127.0.0.1:54321/realtime/v1/health` check in `run_e2e.ts` to fail/timeout. To fix this, `supabase/config.toml` must be updated to `[realtime] enabled = true`.
2. **`supabase-go` Daemon Corruption**: In `e2e/run_e2e.ts`, executing `pkill -9 -f "supabase-go"` before `docker rm -f` corrupts the `supabase-go` daemon state. Because the docker containers are still running when the daemon is killed, lockfiles and container states are left orphaned, leading to `Unknown: ChildProcess.exitCode` and `supabase start is already running` errors during subsequent retries. To achieve a bulletproof daemon state reset, `teardownSupabase()` must be restructured to remove all Supabase Docker containers, volumes, and networks first, verify their removal with a wait loop, and only then execute `pkill -9` on `supabase-go`, `npx supabase`, and `bin/supabase`.
3. **Concurrent Process Elimination War**: The lingering process cleanup in `e2e/run_e2e.ts` uses `pgrep` across the entire system, filtering out only direct ancestor PIDs. In a multi-tenant environment where multiple agents/tasks (`pts/3`, `pts/4`, `pts/5`, `task-20`) run concurrently, each new invocation of `run_e2e.ts` detects and kills the `run_e2e.ts` processes of other active terminals. To prevent this adversarial elimination war, `run_e2e.ts` must implement a file-based mutex lock (`/tmp/run_e2e.lock`) to serialize E2E test runs gracefully, and/or scope its lingering process cleanup strictly to the current terminal session/TTY (`ps -t $(tty)` or checking `ps -o tty=`).
4. **Masked Failure Vulnerability**: Invoking the test runner via `exec npx tsx e2e/run_e2e.ts` causes `npx` to become the parent process of `tsx e2e/run_e2e.ts`. When `tsx e2e/run_e2e.ts` receives a SIGKILL (`kill -9`) from another process or a teardown script, `npx` traps the signal but exits with code 0. This creates a critical vulnerability where aborted test runs are reported as successful (`The command completed successfully.`). Changing the invocation string in `TEST_READY.md` to execute `node node_modules/.bin/tsx e2e/run_e2e.ts` directly removes the `npx` wrapper, ensuring that any SIGKILL or abnormal termination results in a non-zero exit code, accurately reflecting test failure.

## 3. Caveats
- **Read-Only Explorer Constraint**: As a `teamwork_preview_explorer`, I am strictly prohibited from implementing these code changes myself. The exact changes formulated below must be executed by a subsequent implementer/worker agent.
- **Multi-Tenant Environment**: The concurrent process elimination war is specific to shared environments with multiple active agent terminals. The proposed file-based mutex lock (`/tmp/run_e2e.lock`) assumes `/tmp` is shared across these terminal sessions, which is standard for Linux environments.

## 4. Conclusion
The failures and vulnerabilities identified by the Verification Swarm in Iteration 5 are caused by four specific misconfigurations and logical flaws across `supabase/config.toml`, `e2e/run_e2e.ts`, and `TEST_READY.md`. To achieve a robust, multi-tenant aware Tier 3 E2E test pass (Milestone 5.3), the following concrete fix strategy must be implemented:

### Concrete Fix Strategy & Exact Changes Needed

#### 1. `supabase/config.toml` (Realtime Contract Alignment)
- **Target File**: `supabase/config.toml`
- **Location**: Lines 81-82
- **Exact Change**: Change `enabled = false` to `enabled = true` under `[realtime]`.
```toml
[realtime]
enabled = true
```

#### 2. `e2e/run_e2e.ts` (Bulletproof Daemon Reset, Mutex Locking & TTY-Scoped Cleanup)
- **Target File**: `e2e/run_e2e.ts`
- **Exact Changes**:
  1. **File-Based Mutex Lock (`/tmp/run_e2e.lock`)**:
     - At the very beginning of `setup()` (around line 29), implement a mutex lock check. If `/tmp/run_e2e.lock` exists, wait or exit cleanly with an informative message rather than killing other processes.
     - In `cleanup()` (around line 117), ensure `fs.unlinkSync('/tmp/run_e2e.lock')` is called to release the lock.
     ```typescript
     // In setup():
     const lockPath = '/tmp/run_e2e.lock';
     if (fs.existsSync(lockPath)) {
       console.log(`Mutex lock ${lockPath} exists. Another E2E test runner is active. Waiting for lock to release...`);
       let lockRetries = 60;
       while (lockRetries > 0 && fs.existsSync(lockPath)) {
         execSync('sleep 2', { stdio: 'inherit' });
         lockRetries--;
       }
       if (fs.existsSync(lockPath)) {
         console.error(`Mutex lock ${lockPath} still exists after waiting. Exiting to prevent process elimination war.`);
         process.exit(1);
       }
     }
     fs.writeFileSync(lockPath, `${process.pid}`);
     ```
  2. **Bulletproof Supabase Teardown (`teardownSupabase()`, lines 14-26)**:
     - Reorder the teardown sequence so `docker rm -f` executes BEFORE `pkill -9 -f "supabase-go"`. Add a wait loop to ensure containers are fully removed before killing daemons.
     ```typescript
     function teardownSupabase() {
       console.log('Performing bulletproof Supabase teardown and cleanup...');
       try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
       // Docker container, volume, and network cleanup BEFORE pkill
       try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('while docker ps -aq --filter name=supabase | grep -q .; do sleep 1; done 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       // Targeted pkill for Supabase CLI/daemon processes AFTER docker cleanup
       try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('rm -rf supabase/.temp /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
     }
     ```
  3. **TTY-Scoped Lingering Process Cleanup (lines 249-283 & 290-313)**:
     - Modify the process killing logic to filter by the current terminal TTY (`ps -o tty= -p <pid>`) so it only kills lingering processes spawned within the same terminal session, preventing concurrent runners (`pts/3`, `pts/4`, `pts/5`) from killing each other.
     ```typescript
     // Example TTY filtering logic to replace global pgrep/kill:
     try {
       const myTty = execSync(`ps -o tty= -p ${process.pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
       if (myTty && myTty !== '?') {
         const pgrepPids = execSync('pgrep -f "node|tsx|jest|webpack|run_e2e" 2>/dev/null || true', { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
         const pidsToKill = pgrepPids.filter(pid => {
           if (ancestorPids.has(pid) || pid === process.pid) return false;
           try {
             const pTty = execSync(`ps -o tty= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
             return pTty === myTty;
           } catch(e) { return false; }
         });
         if (pidsToKill.length > 0) {
           console.log(`Killing lingering processes scoped to TTY ${myTty}: ${pidsToKill.join(' ')}`);
           execSync(`kill -9 ${pidsToKill.join(' ')} 2>/dev/null || true`, { stdio: 'inherit' });
         }
       }
     } catch(e){}
     ```

#### 3. `TEST_READY.md` (Preventing Swallowed Exit Codes)
- **Target File**: `TEST_READY.md`
- **Location**: Line 4
- **Exact Change**: Replace `exec npx tsx e2e/run_e2e.ts` with `node node_modules/.bin/tsx e2e/run_e2e.ts`.
```markdown
- Command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts`
```

## 5. Verification Method
To independently verify the effectiveness of the implemented fixes:

1. **Verify `supabase/config.toml`**:
   - Inspect `supabase/config.toml` and confirm `[realtime]` has `enabled = true`.

2. **Verify `TEST_READY.md`**:
   - Inspect `TEST_READY.md` line 4 and confirm `node node_modules/.bin/tsx e2e/run_e2e.ts` is used instead of `exec npx tsx`.

3. **Verify `e2e/run_e2e.ts` Teardown & Mutex Logic**:
   - Inspect `e2e/run_e2e.ts` to ensure `docker rm -f` precedes `pkill -9 -f "supabase-go"` in `teardownSupabase()`.
   - Confirm `/tmp/run_e2e.lock` is created in `setup()` and unlinked in `cleanup()`.
   - Confirm lingering process cleanup filters by TTY (`ps -o tty=`).

4. **Execute Master E2E Test Runner**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
   - **Expected Result**: All standalone verification scripts pass 100%. `run_e2e.ts` establishes `/tmp/run_e2e.lock`, successfully starts Supabase without daemon corruption (`ChildProcess.exitCode`), performs TTY-scoped cleanup without killing concurrent terminal sessions, completes the Next.js build and Playwright tests, unlinks the lockfile, and exits with code 0. If aborted with `kill -9`, the command correctly terminates with a non-zero exit code.
