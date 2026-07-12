# Handoff Report: Milestone 5.3 Tier 3 E2E Exploration & Concrete Fix Strategy (Tier 3 E2E Explorer 16)

**Work Product**: Analysis of Verification Swarm Feedback (Iteration 5) and Concrete Fix Strategy for Milestone 5.3 (`supabase/config.toml`, `e2e/run_e2e.ts`, `TEST_READY.md`)
**Profile**: General Project
**Verdict**: ACTIONABLE FIX STRATEGY FORMULATED (Ready for Implementer)

---

## 1. Observation

### Verification Swarm Feedback & Contract Inspection
- **Challenger 9 (FAILURE)**:
  - **Realtime Contract Violation**: `SCOPE.md` explicitly requires `[realtime] enabled = true`. However, `supabase/config.toml` (line 82) has `[realtime] enabled = false`.
  - **Unresolved `supabase-go` Daemon Corruption & `ChildProcess.exitCode` Errors**: `npx supabase start` and `npx supabase db reset` consistently fail with `Unknown: ChildProcess.exitCode (.../bin/supabase-go --output json --debug start)` and collide with `supabase start is already running.` / `supabase_db_expense-dashboard container is not ready: starting`. `teardownSupabase()` fails to cleanly reset the `supabase-go` daemon state.
  - **Masked Failure in Full Test Runner**: When Supabase start/reset failed and triggered `teardownSupabase()`, the test runner abruptly terminated with exit code 0 (`The command completed successfully.`). The Next.js build and Playwright tests were completely skipped, yet the runner falsely reported success (exit code 0) because `tsx`/`npx` absorbs the SIGKILL/SIGTERM of the child process without propagating the error.

- **Challenger 10 (CONDITIONAL SUCCESS / VULNERABILITY DISCOVERED)**:
  - **Concurrent Process Elimination War**: In a shared environment where multiple automated test runners or agent terminals (`pts/3`, `pts/4`, `pts/5`, `task-20`) execute concurrently, Worker 6's lingering process cleanup (`kill -9`) creates an adversarial "process elimination war". When `task-20` started, it killed existing `run_e2e` processes. But ~30 seconds later, while `task-20` was waiting in `init_db.ts`, another terminal started its own `run_e2e.ts`. That new process executed `setup()`, identified `task-20`'s `run_e2e.ts` process, and abruptly killed it with `kill -9`.
  - **Masked Failure Vulnerability**: `task-20` was invoked via `exec npx tsx e2e/run_e2e.ts`. The `exec` command replaces the shell process with `npx`, making `npx` the direct parent of `tsx e2e/run_e2e.ts`. When `tsx e2e/run_e2e.ts` is killed with `kill -9` by another agent's `run_e2e.ts`, `npx` sees its child terminate with SIGKILL but exits with code 0.
  - **Hardening Recommendations**: To make `run_e2e.ts` fully multi-tenant aware, lingering process cleanup should be scoped to the current terminal session/TTY or use a file-based mutex lock (`/tmp/run_e2e.lock`) rather than a global `pgrep/kill -9` across all TTYs. Additionally, invoking `run_e2e.ts` directly via `node node_modules/.bin/tsx e2e/run_e2e.ts` instead of `exec npx tsx` would prevent `npx` from swallowing SIGKILL exit codes.

- **Forensic Auditor 5 (CLEAN)**: Confirmed zero hardcoded test results, zero facade implementations, zero fabricated logs, zero unauthorized git pushes.
- **Reviewers 9 & 10 (APPROVE)**: Confirmed `outputFileTracing: false` in `experimental` block of `next.config.js`, `NODE_OPTIONS: ''` sanitization, `docker rm -f` before `pkill`, explicit `process.exit(1)`, lingering process cleanup.

### Codebase Inspection (`view_file` on `supabase/config.toml`, `e2e/run_e2e.ts`, `TEST_READY.md`)
- **`supabase/config.toml`**: Lines 81-82 show:
  ```toml
  [realtime]
  enabled = false
  ```
- **`e2e/run_e2e.ts`**:
  - `teardownSupabase()` (lines 14-24) executes `pkill -9 -f "supabase-go"` before `docker ps -a -q --filter name=supabase | xargs -r docker rm -f`. This contradicts the requirement in `SCOPE.md` (line 15) and Reviewer approval expectations to execute `docker rm -f` before `pkill` to prevent `supabase-go` daemon corruption.
  - `setup()` (lines 26-91) and `run()` (lines 247-281) perform global process cleanup using `pgrep -f "node.*run_e2e"` and `pgrep -f "tsx.*run_e2e"` followed by `kill -9`, which triggers the concurrent process elimination war across TTYs.
- **`TEST_READY.md`**: Line 4 shows the test runner invocation string:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
  ```

---

## 2. Logic Chain

1. **Realtime Contract Violation**: Setting `[realtime] enabled = false` in `supabase/config.toml` directly violates `SCOPE.md` and causes `http://127.0.0.1:54321/realtime/v1/health` health checks to fail or time out. Changing this to `enabled = true` aligns with the required contract.
2. **`supabase-go` Daemon Corruption & `ChildProcess.exitCode` Errors**: When `pkill -9 -f "supabase-go"` is executed before `docker rm -f`, the Supabase CLI daemon is forcefully killed while Docker containers and network attachments are still active. This leaves orphaned lockfiles, corrupted state files in `supabase/.temp`, and lingering container bindings (`supabase start is already running.`), resulting in `Unknown: ChildProcess.exitCode` errors on subsequent `npx supabase start` or `npx supabase db reset` calls. Reordering `teardownSupabase()` so that `docker rm -f`, `docker volume rm -f`, and `fuser -k` execute *before* `pkill -9 -f supabase-go` ensures the daemon shuts down cleanly or is terminated only after its resources are released.
3. **Concurrent Process Elimination War**: The use of global `pgrep -f "node.*run_e2e"` and `kill -9` in `e2e/run_e2e.ts` causes independent test runners in different terminal sessions (`pts/3`, `pts/4`, `pts/5`, `task-20`) to terminate each other. Implementing a file-based mutex lock (`/tmp/run_e2e.lock`) or TTY-scoped cleanup prevents concurrent executions from colliding or engaging in an adversarial kill loop.
4. **Masked Failure Vulnerability**: Invoking the test runner via `exec npx tsx e2e/run_e2e.ts` makes `npx` the parent process of `tsx`. When `tsx e2e/run_e2e.ts` is killed (via SIGKILL/SIGTERM) or abruptly aborted during teardown, `npx` absorbs the signal and exits with code 0 (`The command completed successfully.`). This masks critical E2E failures. Invoking `run_e2e.ts` directly via `node node_modules/.bin/tsx e2e/run_e2e.ts` bypasses `npx`, ensuring that any SIGKILL, SIGTERM, or non-zero exit code is correctly propagated to the shell and task runner.

---

## 3. Caveats

- **Read-Only Explorer Constraint**: As a `teamwork_preview_explorer`, I am strictly prohibited from modifying source code or configuration files directly. Therefore, the exact changes formulated below must be applied by a subsequent implementer agent.
- **Environment Concurrency**: The file-based mutex lock (`/tmp/run_e2e.lock`) assumes that all concurrent test runners respect the lockfile. If an older, unmodified test runner is executed concurrently, it may still attempt global `pgrep`/`kill -9`. All active terminals should use the updated `run_e2e.ts` to ensure complete multi-tenant stability.

---

## 4. Conclusion

To achieve a 100% successful Tier 3 E2E test pass (Milestone 5.3) and eliminate all contract violations, daemon corruption, process elimination wars, and masked failure vulnerabilities, the implementer must apply the following precise modifications:

### 1. `supabase/config.toml` (Realtime Contract Alignment)
Modify lines 81-82 to enable Realtime:
```toml
[realtime]
enabled = true
```

### 2. `e2e/run_e2e.ts` (Bulletproof Teardown & File-Based Mutex Lock)
- **Bulletproof `teardownSupabase()`**: Reorder the teardown sequence so `docker rm -f`, `docker volume rm -f`, `fuser -k`, and `rm -rf` execute BEFORE `pkill -9`.
  ```typescript
  function teardownSupabase() {
    console.log('Performing bulletproof Supabase teardown and cleanup...');
    try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('rm -rf supabase/.temp /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
  }
  ```

- **File-Based Mutex Locking (`/tmp/run_e2e.lock`)**: Replace the global `pgrep`/`kill -9` in `setup()` and `run()` with a robust file-based mutex lock mechanism.
  At the top of `e2e/run_e2e.ts`:
  ```typescript
  const lockFilePath = '/tmp/run_e2e.lock';
  ```
  In `setup()` (replace any lingering process killing):
  ```typescript
  console.log('Acquiring file-based mutex lock (/tmp/run_e2e.lock)...');
  let lockAcquired = false;
  let lockRetries = 60;
  while (lockRetries > 0 && !lockAcquired) {
    try {
      if (fs.existsSync(lockFilePath)) {
        const lockPid = fs.readFileSync(lockFilePath, 'utf-8').trim();
        try {
          // Check if the PID holding the lock is still alive
          execSync(`ps -p ${lockPid} 2>/dev/null`);
          console.log(`Another run_e2e process (PID ${lockPid}) is currently running. Waiting... (${lockRetries} retries left)`);
        } catch (e) {
          console.log(`Stale lockfile detected for dead PID ${lockPid}. Reclaiming lock...`);
          fs.writeFileSync(lockFilePath, process.pid.toString(), { flag: 'w' });
          lockAcquired = true;
          break;
        }
      } else {
        fs.writeFileSync(lockFilePath, process.pid.toString(), { flag: 'wx' });
        lockAcquired = true;
        break;
      }
    } catch (e) {
      // Lock collision, retry
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
    lockRetries--;
  }
  if (!lockAcquired) {
    console.error('Failed to acquire mutex lock /tmp/run_e2e.lock after 120 seconds. Exiting.');
    process.exit(1);
  }
  ```
  In `cleanup()`:
  ```typescript
  if (fs.existsSync(lockFilePath)) {
    try {
      const lockPid = fs.readFileSync(lockFilePath, 'utf-8').trim();
      if (lockPid === process.pid.toString()) {
        fs.unlinkSync(lockFilePath);
        console.log('Released mutex lock /tmp/run_e2e.lock.');
      }
    } catch(e){}
  }
  ```
  Remove the global `pgrep -f "node.*run_e2e"` / `kill -9` blocks in `run()` (lines 247-281) to prevent process elimination wars.

### 3. `TEST_READY.md` (Prevent Swallowed Exit Codes)
Modify line 4 in `TEST_READY.md` to invoke `node node_modules/.bin/tsx e2e/run_e2e.ts` directly instead of `exec npx tsx e2e/run_e2e.ts`:
```markdown
- Command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts`
```

---

## 5. Verification Method

To independently verify the fixes once implemented:

1. **Inspect `supabase/config.toml`**:
   Verify `[realtime]` has `enabled = true`.

2. **Inspect `e2e/run_e2e.ts`**:
   - Verify `teardownSupabase()` executes `docker rm -f` before `pkill -9 -f "supabase-go"`.
   - Verify `setup()` implements the `/tmp/run_e2e.lock` mutex lock loop and does not execute global `pgrep`/`kill -9` against `run_e2e`.

3. **Inspect `TEST_READY.md`**:
   Verify the test runner command ends with `node node_modules/.bin/tsx e2e/run_e2e.ts`.

4. **Execute Master E2E Test Runner**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
   **Expected Result**: All verification scripts pass. `run_e2e.ts` acquires `/tmp/run_e2e.lock`, starts Supabase cleanly without daemon corruption (`Unknown: ChildProcess.exitCode`), verifies Realtime health successfully, builds Next.js, executes Playwright tests successfully, releases the lockfile, and terminates with exit code 0. If a failure occurs, `node node_modules/.bin/tsx` correctly propagates exit code 1.
