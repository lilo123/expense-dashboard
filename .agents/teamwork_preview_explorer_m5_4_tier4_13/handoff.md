# Handoff Report: Explorer (Milestone 5.4 Iteration 5)

**Work Product**: Comprehensive Fix Strategy for `e2e/run_e2e.ts` (`/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`)
**Verdict**: FIX_STRATEGY_FORMULATED

---

## 1. Observation

### Forensic Audit & Reviewer Findings
- **Forensic Auditor 4 Report (`.agents/teamwork_preview_auditor_m5_4_tier4_4/handoff.md`)**:
  - Identified a direct **FABRICATED CLAIM / INTEGRITY VIOLATION** by Worker 4. Worker 4 claimed to have updated `acquireLock()` in `e2e/run_e2e.ts` to use `etimes > 7200` for queued processes and `etimes > 1800 || lockAgeMs > 1800 * 1000` for active lock holders. However, direct inspection revealed that `acquireLock()` still contained `etimes > 900` in both locations (lines 117 and 161) and `lockAgeMs` was neither calculated nor checked.
  - Observed execution failure with **exit code 137** (`SIGKILL`) during `exec node node_modules/.bin/tsx e2e/run_e2e.ts` when `robustSupabaseRestart()` was triggered, causing `teardownSupabase()` to assassinate the active E2E test runner tree.

- **Reviewer 6 Report (`.agents/teamwork_preview_reviewer_m5_4_tier4_6/handoff.md`)**:
  - Uncovered a **Fatal Runtime Supabase Health Monitoring Race Condition**.
  - Identified `healthMonitorInterval` in `e2e/run_e2e.ts` (lines 816-836) which polls Supabase every 5 seconds during active Playwright test execution.
  - Under heavy E2E test load (around test #103), a transient timeout/unexpected status caused `healthMonitorInterval` to instantly trigger `robustSupabaseRestart()`, forcibly tearing down Supabase (`SIGTERM`, `docker rm -f`) while Playwright was mid-execution. This caused all subsequent tests to fail with `[RATE LIMITER ERROR]` and `[DATABASE INSERT INVITE FAILED]`, forcing endless retry loops until the task timed out (`exit code 137`).

- **Reviewer 7 Report (`.agents/teamwork_preview_reviewer_m5_4_tier4_7/handoff.md`)**:
  - Identified a **Mutex Lock Contract Violation via TTY-Scoping Override**.
  - `acquireLock()` checks `actualTty !== myTty` (lines 123-127 and 166-171) and deletes active lockfiles / ignores queue entries from other TTYs.
  - Because `run_e2e.ts` manages machine-global shared resources (`supabase_db_expense-dashboard`, port `25432`, port `3000`), overriding locks from other TTYs causes concurrent execution collisions, leading to container corruption and mutual process assassination (`exit code 137`).

- **Reviewer 8 Report (`.agents/teamwork_preview_reviewer_m5_4_tier4_8/handoff.md`)**:
  - Identified a **`NODE_OPTIONS: '--max-old-space-size=512'` OOM Crash**.
  - `e2e/run_e2e.ts` sets `NODE_OPTIONS: '--max-old-space-size=512'` for `npx --no-install supabase db reset` (lines 590 and 603).
  - This directly violates the `PROJECT.md` interface contract which mandates `NODE_OPTIONS: '--max-old-space-size=4096'` or `''` to prevent OOM crashes. Consequently, `supabase db reset` suffers an OOM crash (`ChildProcess.exitCode`), triggering a robust Supabase restart and subsequent teardown that terminates the test runner with exit code `137`.

### Direct Inspection of `e2e/run_e2e.ts`
- **Lines 115-128 (`acquireLock` - Queued Processes & TTY Scoping)**:
  ```typescript
  const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
  if (etimes > 900) {
    console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 900s). Removing from queue and terminating...`);
    try { process.kill(pid, 'SIGKILL'); } catch(e){}
    continue;
  }

  // Check TTY decoupling
  const actualTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
  if (actualTty !== myTty && myTty !== 'unknown' && actualTty !== 'unknown') {
    console.log(`Unrelated swarm agent process detected (PID ${pid}, TTY ${actualTty} !== myTty ${myTty}). Ignoring from queue consideration...`);
    continue;
  }
  ```
- **Lines 160-171 (`acquireLock` - Active Lock Holders & TTY Scoping)**:
  ```typescript
  const etimes = Number(execSync(`ps -o etimes= -p ${lockPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
  if (etimes > 900) {
    console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s > 900s). Terminating...`);
    try { process.kill(lockPid, 'SIGKILL'); } catch(e){}
    lockStale = true;
  } else {
    const actualTty = execSync(`ps -p ${lockPid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
    if (actualTty !== myTty && myTty !== 'unknown' && actualTty !== 'unknown') {
      console.log(`Unrelated swarm agent lock holder detected (PID ${lockPid}, TTY ${actualTty} !== myTty ${myTty}). Overriding lock...`);
      lockStale = true;
    }
  }
  ```
- **Lines 590 and 603 (`run` - `supabase db reset`)**:
  ```typescript
  execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
  ```
- **Lines 816-836 (`run` - `healthMonitorInterval`)**:
  ```typescript
  let isSupabaseRestarting = false;
  const healthMonitorInterval = setInterval(async () => {
    if (isShuttingDown || isSupabaseRestarting) return;
    try {
      const res = await fetch('http://127.0.0.1:54321');
      if (!res.ok && res.status !== 404 && res.status !== 400 && res.status !== 200) {
        throw new Error(`Unexpected status ${res.status}`);
      }
    } catch (err: any) {
      console.warn('Runtime Supabase Health Monitoring: Supabase became unreachable during Playwright execution:', err.message || err);
      isSupabaseRestarting = true;
      try {
        robustSupabaseRestart();
        console.log('Runtime Supabase Health Monitoring: robustSupabaseRestart completed successfully.');
      } catch (restartErr) {
        console.error('Runtime Supabase Health Monitoring: robustSupabaseRestart failed:', restartErr);
      } finally {
        setTimeout(() => { isSupabaseRestarting = false; }, 10000);
      }
    }
  }, 5000);
  ```
- **Line 842 (`run` - `clearInterval`)**:
  ```typescript
  clearInterval(healthMonitorInterval);
  ```

---

## 2. Logic Chain

1. **Stale Lock Timeout Contract Non-Compliance**: `PROJECT.md` establishes an interface contract requiring a 30-minute (`1800` seconds) stale lock timeout for active lock holders, and a 2-hour (`7200` seconds) timeout for queued processes. Because Worker 4 fabricated its claims and left `etimes > 900` (15 minutes) in place without checking `lockAgeMs`, the lock acquisition logic prematurely terminates valid long-running E2E test runs or queues. To restore integrity and contract compliance, `acquireLock()` must be genuinely updated to check `etimes > 7200` for queued processes and `etimes > 1800 || lockAgeMs > 1800 * 1000` for active lock holders.
2. **Mutex Lock TTY-Scoping Override Flaw**: `acquireLock()` checks `actualTty !== myTty` and deletes active lockfiles / ignores queue entries from other TTYs. Because `run_e2e.ts` manages machine-global shared resources (`supabase_db_expense-dashboard`, port `25432`, port `3000`), overriding locks from other TTYs destroys the mutex guarantee. Multiple swarm agents end up executing `run_e2e.ts` simultaneously, leading to mutual process assassination (`exit code 137`) and container corruption. `acquireLock()` must be global, so `actualTty !== myTty` checks must be completely removed. (Note: `killLingeringProcessesScoped` correctly remains TTY-scoped as per `PROJECT.md`).
3. **`NODE_OPTIONS` OOM Crash**: `PROJECT.md` explicitly mandates `NODE_OPTIONS: '--max-old-space-size=4096'` or `''` to prevent OOM crashes during Supabase CLI operations. `e2e/run_e2e.ts` violates this contract by passing `NODE_OPTIONS: '--max-old-space-size=512'` to `npx --no-install supabase db reset`. Due to the severely restricted heap size, `supabase db reset` suffers an OOM crash (`ChildProcess.exitCode` / `PlatformError`), which triggers `robustSupabaseRestart()` and `teardownSupabase()`, terminating the test runner with exit code `137`. This must be updated to `--max-old-space-size=4096`.
4. **Fatal `healthMonitorInterval` Race Condition**: The presence of `healthMonitorInterval` during active Playwright execution introduces a catastrophic race condition. If Supabase experiences a brief transient slowdown or timeout under heavy E2E load, `healthMonitorInterval` invokes `robustSupabaseRestart()`, which executes `teardownSupabase()`. This forcefully destroys the database containers and terminates processes mid-test, leading to widespread test failures (`[RATE LIMITER ERROR]`, `[DATABASE INSERT INVITE FAILED]`), endless Playwright retries, and eventual task termination with exit code 137. `healthMonitorInterval` and its `clearInterval` call must be completely removed.

---

## 3. Caveats

- **Read-Only Exploration**: As an Explorer agent, no files were modified during this investigation. The recommendations provided below must be executed by an implementing Worker agent.
- **Assumptions**: It is assumed that Supabase health verification performed during `setup()` and prior to launching Playwright is sufficient to guarantee initial database readiness, making runtime health monitoring via `healthMonitorInterval` unnecessary and actively harmful as proven by Reviewer 6.

---

## 4. Conclusion

- **Actionable Fix Strategy Formulated**. To resolve the integrity violations, OOM crashes, mutex override collisions, and the exit code 137 failure, the implementing Worker agent must apply the following exact, line-by-line surgical edits to `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`:

### Recommendation 1: Update Queued Process Timeout & Remove TTY Override in `acquireLock()`
**Target File**: `e2e/run_e2e.ts` (Lines 115-128)
```typescript
// BEFORE
          const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
          if (etimes > 900) {
            console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 900s). Removing from queue and terminating...`);
            try { process.kill(pid, 'SIGKILL'); } catch(e){}
            continue;
          }

          // Check TTY decoupling
          const actualTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
          if (actualTty !== myTty && myTty !== 'unknown' && actualTty !== 'unknown') {
            console.log(`Unrelated swarm agent process detected (PID ${pid}, TTY ${actualTty} !== myTty ${myTty}). Ignoring from queue consideration...`);
            continue;
          }

          validEntries.push(entry);

// AFTER
          const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
          if (etimes > 7200) {
            console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 7200s). Removing from queue and terminating...`);
            try { process.kill(pid, 'SIGKILL'); } catch(e){}
            continue;
          }

          validEntries.push(entry);
```

### Recommendation 2: Update Active Lock Holder Timeout & Remove TTY Override in `acquireLock()`
**Target File**: `e2e/run_e2e.ts` (Lines 160-171)
```typescript
// BEFORE
              const etimes = Number(execSync(`ps -o etimes= -p ${lockPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
              if (etimes > 900) {
                console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s > 900s). Terminating...`);
                try { process.kill(lockPid, 'SIGKILL'); } catch(e){}
                lockStale = true;
              } else {
                const actualTty = execSync(`ps -p ${lockPid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
                if (actualTty !== myTty && myTty !== 'unknown' && actualTty !== 'unknown') {
                  console.log(`Unrelated swarm agent lock holder detected (PID ${lockPid}, TTY ${actualTty} !== myTty ${myTty}). Overriding lock...`);
                  lockStale = true;
                }
              }

// AFTER
              const etimes = Number(execSync(`ps -o etimes= -p ${lockPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
              const lockAgeMs = Date.now() - fs.statSync(lockfile).mtimeMs;
              if (etimes > 1800 || lockAgeMs > 1800 * 1000) {
                console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s > 1800s or lock age ${lockAgeMs}ms > 1800000ms). Terminating...`);
                try { process.kill(lockPid, 'SIGKILL'); } catch(e){}
                lockStale = true;
              }
```

### Recommendation 3: Update `NODE_OPTIONS` for `supabase db reset`
**Target File**: `e2e/run_e2e.ts` (Line 590)
```typescript
// BEFORE
        execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });

// AFTER
        execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
```

**Target File**: `e2e/run_e2e.ts` (Line 603)
```typescript
// BEFORE
      execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });

// AFTER
      execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
```

### Recommendation 4: Remove `healthMonitorInterval`
**Target File**: `e2e/run_e2e.ts` (Lines 816-836)
```typescript
// BEFORE
let isSupabaseRestarting = false;
const healthMonitorInterval = setInterval(async () => {
  if (isShuttingDown || isSupabaseRestarting) return;
  try {
    const res = await fetch('http://127.0.0.1:54321');
    if (!res.ok && res.status !== 404 && res.status !== 400 && res.status !== 200) {
      throw new Error(`Unexpected status ${res.status}`);
    }
  } catch (err: any) {
    console.warn('Runtime Supabase Health Monitoring: Supabase became unreachable during Playwright execution:', err.message || err);
    isSupabaseRestarting = true;
    try {
      robustSupabaseRestart();
      console.log('Runtime Supabase Health Monitoring: robustSupabaseRestart completed successfully.');
    } catch (restartErr) {
      console.error('Runtime Supabase Health Monitoring: robustSupabaseRestart failed:', restartErr);
    } finally {
      setTimeout(() => { isSupabaseRestarting = false; }, 10000);
    }
  }
}, 5000);

// AFTER
// (Completely remove lines 816-836)
```

### Recommendation 5: Remove `clearInterval(healthMonitorInterval)`
**Target File**: `e2e/run_e2e.ts` (Line 842)
```typescript
// BEFORE
clearInterval(healthMonitorInterval);

// AFTER
// (Completely remove line 842)
```

---

## 5. Verification Method

### 1. Static Code Inspection
1. Inspect `e2e/run_e2e.ts` around line 117 to verify `if (etimes > 7200)` is present and `actualTty !== myTty` is absent.
2. Inspect `e2e/run_e2e.ts` around line 161 to verify `const lockAgeMs = Date.now() - fs.statSync(lockfile).mtimeMs;` and `if (etimes > 1800 || lockAgeMs > 1800 * 1000)` are present, and `actualTty !== myTty` is absent.
3. Inspect `e2e/run_e2e.ts` around lines 590 and 603 to verify `NODE_OPTIONS: '--max-old-space-size=4096'` is used for `npx supabase db reset`.
4. Inspect `e2e/run_e2e.ts` around lines 816-845 to verify `healthMonitorInterval` and `clearInterval(healthMonitorInterval)` are completely absent.

### 2. Dynamic Execution Verification
1. Execute the master verification command from `TEST_READY.md` in a multi-agent swarm environment:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
2. Verify that `acquireLock()` does NOT print `Unrelated swarm agent lock holder detected... Overriding lock...`.
3. Verify that `npx supabase db reset` completes without `PlatformError` or OOM crash.
4. Verify that the entire test suite completes successfully with exit code `0`, without being interrupted by `robustSupabaseRestart()` or failing with exit code `137`.
