# Handoff Report: Milestone 5.3 Investigation & Concrete Fix Strategy (Tier 3 E2E Explorer 20)

**Work Product**: Investigation of Challenger 9 FAILURE, Masked Failure Vulnerability, and Teardown/Process Collisions (`supabase/config.toml`, `e2e/run_e2e.ts`, `TEST_READY.md`)
**Profile**: General Project
**Verdict**: FAILURE (Contract Violations, Daemon Corruption, Process Elimination War, and Masked Failure Vulnerabilities Confirmed)

---

## 1. Observation

### A. Realtime Contract Violation (`supabase/config.toml`)
- **Contract Requirement**: `SCOPE.md` lines 13-14 explicitly requires `[realtime] enabled = true` in `supabase/config.toml` to support the explicit health check loop for `http://127.0.0.1:54321/realtime/v1/health`.
- **Direct Observation**: Inspected `/usr/local/google/home/duynguyenn/expense-dashboard/supabase/config.toml` lines 81-82. Observed:
  ```toml
  [realtime]
  enabled = false
  ```

### B. Persistent `supabase-go` Daemon Corruption (`e2e/run_e2e.ts`)
- **Contract Requirement**: `SCOPE.md` line 15 explicitly defines the `Teardown Sequence` contract:
  > `Standardized bulletproof teardown sequence across all 9 locations (npx supabase stop, pkill -9 -f supabase, pkill -9 -f supabase-go, pkill -9 -f npx supabase, docker rm -f, docker volume rm -f, while docker ps -aq, fuser -k 25432/tcp, rm -rf supabase/.temp, sleep 20) ensuring pkill executes after docker rm -f to prevent supabase-go daemon corruption.`
- **Direct Observation**: Inspected `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts` lines 14-25. Observed:
  ```typescript
  function teardownSupabase() {
    console.log('Performing bulletproof Supabase teardown and cleanup...');
    // Targeted pkill for Supabase CLI/daemon processes BEFORE docker cleanup
    try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    // Docker container and volume cleanup (targeted)
    try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('rm -rf supabase/.temp /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
  }
  ```
  `pkill -9 -f "supabase-go"` executes BEFORE `docker rm -f`. `npx supabase stop`, `pkill -9 -f supabase`, `pkill -9 -f npx supabase`, and the `while docker ps -aq` wait loop are completely omitted, and `sleep 5` is used instead of `sleep 20`.

### C. Concurrent Process Elimination War (`e2e/run_e2e.ts`)
- **Direct Observation**: Inspected `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts` lines 205-239 and lines 246-269. Observed global process matching and killing:
  ```typescript
  const nodePids = execSync('pgrep -f "node.*run_e2e" 2>/dev/null || true', { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
  const tsxPids = execSync('pgrep -f "tsx.*run_e2e" 2>/dev/null || true', { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
  // ... filters out ancestorPids ...
  execSync(`kill -9 ${pids.join(' ')} 2>/dev/null || true`, { stdio: 'inherit' });
  ```
  and post-build:
  ```typescript
  const pgrepNode = execSync('pgrep -f "node|tsx|jest|webpack" 2>/dev/null || true', { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
  // ... filters out ancestorPids ...
  execSync(`kill -9 ${pidsToKill.join(' ')} 2>/dev/null || true`, { stdio: 'inherit' });
  ```
  This aggressively identifies all `run_e2e`, `node`, `tsx`, `jest`, and `webpack` processes across the entire machine (excluding only its own direct ancestors) and terminates them with `kill -9`.

### D. Masked Failure & Exit Code 0 Vulnerability (`TEST_READY.md` & `e2e/run_e2e.ts`)
- **Direct Observation**: Inspected `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md` line 4. Observed:
  ```markdown
  - Command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts`
  ```
  The master E2E test runner is invoked via `exec npx tsx e2e/run_e2e.ts`.

---

## 2. Logic Chain

1. **Realtime Contract Violation**: Setting `[realtime] enabled = false` in `supabase/config.toml` disables the Supabase Realtime engine. This directly violates the `SCOPE.md` contract and causes the `http://127.0.0.1:54321/realtime/v1/health` check in `run_e2e.ts` to fail or timeout.
2. **Persistent `supabase-go` Daemon Corruption**: The `Unknown: ChildProcess.exitCode` error occurs because `teardownSupabase()` executes `pkill -9 -f "supabase-go"` before `docker rm -f`. Terminating the `supabase-go` daemon while the Supabase Docker containers are still actively running corrupts the daemon's internal state and lockfiles. Furthermore, omitting `npx supabase stop`, the `while docker ps -aq` wait loop, and using `sleep 5` instead of `sleep 20` leaves lingering containers and ports (`25432`) active, causing subsequent `npx supabase start` and `npx supabase db reset` commands to fail persistently.
3. **Concurrent Process Elimination War**: In a multi-tenant or multi-terminal environment where multiple automated test runners or agent tasks (`pts/3`, `pts/4`, `pts/5`, `task-20`) execute concurrently, using a global `pgrep` and `kill -9` across all TTYs creates an adversarial process elimination war. When one test runner reaches the pre-build or post-build phase, it identifies the `node`, `tsx`, or `run_e2e` processes of other concurrent tasks and abruptly kills them with `kill -9`.
4. **Masked Failure & Exit Code 0 Vulnerability**: Because `TEST_READY.md` invokes the runner via `exec npx tsx e2e/run_e2e.ts`, `exec` replaces the calling shell with `npx`, making `npx` the direct parent of `tsx e2e/run_e2e.ts`. When `tsx e2e/run_e2e.ts` is killed with `kill -9` by a concurrent test runner, or aborts during `teardownSupabase()`, `npx` absorbs the SIGKILL/SIGTERM of its child process without propagating a non-zero exit code to the system. Instead, `npx` exits with code 0 (`The command completed successfully.`). This creates a critical masked failure vulnerability where the Next.js build and Playwright tests are completely skipped, yet the system falsely reports a successful test pass.

---

## 3. Caveats

- **Read-Only Scope**: As an Explorer agent, no files were modified during this investigation. All findings were established via direct inspection of the codebase and synthesis of empirical evidence from previous Challenger/Worker handoff reports.
- **Multi-Tenant Context**: The E2E test runner (`e2e/run_e2e.ts`) functions without process elimination collisions when run in an isolated, single-tenant VM. The process elimination war is specifically triggered by concurrent execution across multiple terminal sessions on the same shared host.

---

## 4. Conclusion

The Milestone 5.3 implementation contains four critical flaws: `supabase/config.toml` violates the Realtime contract; `teardownSupabase()` corrupts the `supabase-go` daemon by killing it before removing Docker containers; `run_e2e.ts` triggers a concurrent process elimination war via global `pgrep/kill -9`; and `TEST_READY.md` introduces a masked failure vulnerability by using `exec npx tsx`, which swallows SIGKILL exit codes.

### Concrete Fix Strategy for Worker

The Worker must implement the following four surgical fixes:

#### 1. Fix Realtime Contract Violation (`supabase/config.toml`)
- **Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/supabase/config.toml`
- **Action**: Modify line 82 under `[realtime]` to change `enabled = false` to `enabled = true`.

#### 2. Fix `supabase-go` Daemon Corruption (`e2e/run_e2e.ts`)
- **Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
- **Action**: Rewrite `teardownSupabase()` (lines 14-25) to strictly adhere to the `SCOPE.md` contract:
  ```typescript
  function teardownSupabase() {
    console.log('Performing bulletproof Supabase teardown and cleanup...');
    try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f supabase-go 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('while docker ps -a -q --filter name=supabase | grep -q .; do sleep 1; done 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('rm -rf supabase/.temp /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
  }
  ```

#### 3. Fix Concurrent Process Elimination War (`e2e/run_e2e.ts`)
- **Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
- **Action**: Replace the global `pgrep` and `kill -9` logic in `run()` (lines 205-239 and lines 246-269) with a file-based mutex lock (`/tmp/run_e2e.lock`) or scope the cleanup strictly to the current TTY/process tree. 
  - *Recommended Mutex Implementation*: At the start of `setup()`, check if `/tmp/run_e2e.lock` exists and is locked by an active process; if so, wait until it is released before proceeding. Remove the lock in `cleanup()`. Remove the aggressive global `pgrep -f "node.*run_e2e"` / `pgrep -f "node|tsx|jest|webpack"` killing entirely to allow safe multi-tenant co-existence.

#### 4. Fix Masked Failure & Exit Code 0 Vulnerability (`TEST_READY.md`)
- **Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- **Action**: Modify line 4 to replace `exec npx tsx e2e/run_e2e.ts` with direct node invocation of `tsx`:
  ```markdown
  - Command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts`
  ```

---

## 5. Verification Method

To independently verify the findings and validate the fixes once implemented by the Worker:

1. **Verify Realtime Configuration**:
   Inspect `supabase/config.toml` and confirm `[realtime]` has `enabled = true`.

2. **Verify Teardown & Process Cleanup Logic**:
   Inspect `e2e/run_e2e.ts` and confirm `teardownSupabase()` executes `docker rm -f` BEFORE `pkill`, includes `while docker ps -aq...`, and ends with `sleep 20`. Confirm global `pgrep/kill -9` has been replaced with mutex locking or TTY-scoped filtering.

3. **Verify Exit Code Integrity & Test Execution**:
   Inspect `TEST_READY.md` to confirm `node node_modules/.bin/tsx e2e/run_e2e.ts` is used instead of `exec npx tsx`.
   Execute the master E2E test runner command:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
   **Expected Result**: All standalone verification scripts and `run_e2e.ts` will execute successfully, start Supabase cleanly without daemon corruption, co-exist safely with concurrent terminal sessions without process elimination wars, pass 100% of Playwright E2E tests, and terminate with exit code 0 (or correctly propagate exit code 1 if any failure occurs).
