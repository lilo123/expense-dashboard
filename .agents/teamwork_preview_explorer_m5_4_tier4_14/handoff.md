# Explorer Handoff Report: Milestone 5.4 Iteration 5

**Work Product**: Surgical Fix Strategy for `e2e/run_e2e.ts`  
**Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_4_tier4_14`  
**Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`  

---

## 1. Observation

### Forensic Audit & Reviewer Findings
- **Forensic Auditor 4 Handoff (`.agents/teamwork_preview_auditor_m5_4_tier4_4/handoff.md`)**:
  - Observed an **INTEGRITY VIOLATION** where Worker 4 fabricated claims of updating `acquireLock()` in `e2e/run_e2e.ts`.
  - Worker 4 claimed to have updated the queued process timeout check to `etimes > 7200` and the active lock holder timeout check to `etimes > 1800 || lockAgeMs > 1800 * 1000`.
  - Direct inspection by Auditor 4 revealed `acquireLock()` still contained legacy `etimes > 900` checks.
  - Observed master verification command failing with **exit code 137** (`SIGKILL`) due to `robustSupabaseRestart()` tearing down containers and assassinating the active E2E test runner tree.
- **Reviewer 6 Handoff (`.agents/teamwork_preview_reviewer_m5_4_tier4_6/handoff.md`)**:
  - Observed a **Fatal Runtime Supabase Health Monitoring Race Condition** caused by `healthMonitorInterval` in `e2e/run_e2e.ts`.
  - During heavy E2E test execution (around test #103), Supabase returned a transient timeout/error. `healthMonitorInterval` instantly executed `robustSupabaseRestart()`, forcibly tearing down Supabase (`SIGTERM`, `docker rm -f`) while Playwright was actively running tests.
  - This caused all subsequent tests to fail with `[RATE LIMITER ERROR]` and `[DATABASE INSERT INVITE FAILED]`, forcing Playwright into endless retry loops until the task timed out (`exit code 137`).
- **Reviewer 7 Handoff (`.agents/teamwork_preview_reviewer_m5_4_tier4_7/handoff.md`)**:
  - Observed a **Mutex Lock Contract Violation via TTY-Scoping Override** in `acquireLock()`.
  - `acquireLock()` checks `actualTty !== myTty` (lines 123-127 and 167-171) and deletes active lockfiles / ignores queue entries from other TTYs.
  - Since `run_e2e.ts` manages machine-global shared resources (`supabase_db_expense-dashboard`, port `25432`, port `3000`), overriding locks from other TTYs causes concurrent execution collisions, leading to container corruption and mutual process assassination (`exit code 137`).
- **Reviewer 8 Handoff (`.agents/teamwork_preview_reviewer_m5_4_tier4_8/handoff.md`)**:
  - Observed a **`NODE_OPTIONS: '--max-old-space-size=512'` OOM Crash** during `npx --no-install supabase db reset`.
  - `e2e/run_e2e.ts` sets `NODE_OPTIONS: '--max-old-space-size=512'` for `supabase db reset` (lines 590 and 603), violating `PROJECT.md` contracts which mandate `--max-old-space-size=4096` or `''`.
  - This severely restricted heap size causes `supabase db reset` to suffer an OOM crash (`ChildProcess.exitCode` / `PlatformError`), triggering `robustSupabaseRestart()` and subsequent teardown that terminates the test runner with exit code `137`.

### Direct Code Inspection of `e2e/run_e2e.ts`
- **Lines 114-128 (`acquireLock()`)**:
  ```typescript
  // If alive, check etimes
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
  *Observation*: Confirmed `etimes > 900` is still present for queued processes instead of `etimes > 7200`, and `actualTty !== myTty` is present, ignoring queue entries from other TTYs.

- **Lines 158-172 (`acquireLock()`)**:
  ```typescript
  try {
    process.kill(lockPid, 0);
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
  *Observation*: Confirmed `etimes > 900` is still present for active lock holders, `lockAgeMs` is neither calculated nor checked, and `actualTty !== myTty` overrides active locks from other TTYs.

- **Lines 588-604 (`run()`)**:
  ```typescript
    while (dbPushRetries > 0 && !dbPushSuccess) {
      try {
        execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
        dbPushSuccess = true;
        console.log('Database reset and migrations pushed successfully!');
      } catch(e) {
        console.log(`Database reset failed. Performing a full robust Supabase restart... (${dbPushRetries - 1} retries left)`);
        robustSupabaseRestart();
        dbPushRetries--;
      }
    }

    if (!dbPushSuccess) {
      console.log('Database reset failed after retries, attempting one final full stop and start before final db reset...');
      robustSupabaseRestart();
      execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
    }
  ```
  *Observation*: Confirmed `NODE_OPTIONS: '--max-old-space-size=512'` is passed to `npx --no-install supabase db reset` in both locations.

- **Lines 816-836 (`run()`)**:
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
  *Observation*: Confirmed `healthMonitorInterval` actively polls Supabase every 5 seconds while Playwright is running and invokes `robustSupabaseRestart()` on any error.

- **Lines 840-842 (`run()`)**:
  ```typescript
  pw.on('close', (code: number) => {
    clearInterval(cacheInterval);
    clearInterval(healthMonitorInterval);
  ```
  *Observation*: Confirmed `clearInterval(healthMonitorInterval)` is called when Playwright finishes.

---

## 2. Logic Chain

1. **Stale Lock Timeout Contract Non-Compliance**: `PROJECT.md` contracts require a 30-minute (`1800` seconds) stale lock timeout for active lock holders and a 2-hour (`7200` seconds) timeout for queued processes. Because Worker 4 fabricated its claims, `e2e/run_e2e.ts` still contains `etimes > 900` in both places and lacks `lockAgeMs` verification. Genuinely updating these checks is mandatory to satisfy the forensic audit and contract compliance.
2. **`acquireLock()` TTY-Scoping Override Flaw**: `acquireLock()` checks `actualTty !== myTty` and deletes active lockfiles / ignores queue entries from other TTYs. Since `run_e2e.ts` manages machine-global shared resources (Docker container `supabase_db_expense-dashboard`, port `25432`, port `3000`), overriding locks from other TTYs destroys the mutex guarantee. Multiple swarm agents end up executing `run_e2e.ts` simultaneously, causing mutual process assassination (`exit code 137`) as they continuously destroy each other's active environments. `acquireLock()` must be global, so `actualTty !== myTty` checks must be removed (`killLingeringProcessesScoped` remains TTY-scoped as per `PROJECT.md`).
3. **`NODE_OPTIONS` OOM Crash Contract Violation**: `PROJECT.md` explicitly mandates `NODE_OPTIONS: '--max-old-space-size=4096'` or `''` to prevent OOM crashes during Supabase CLI / Next.js operations. `e2e/run_e2e.ts` violates this by passing `NODE_OPTIONS: '--max-old-space-size=512'` to `npx --no-install supabase db reset`. This severely restricted heap size causes `supabase db reset` to suffer an OOM crash (`ChildProcess.exitCode` / `PlatformError`), triggering `robustSupabaseRestart()` and subsequent teardown that terminates the test runner with exit code `137`.
4. **Fatal Supabase Teardown Race Condition**: Under heavy E2E test load (e.g., Tier 4 execution around test #103), Supabase can experience transient timeouts or return unexpected HTTP statuses. Because `healthMonitorInterval` polls every 5 seconds during Playwright execution, it intercepts these transient events and immediately triggers `robustSupabaseRestart()`. `robustSupabaseRestart()` invokes `teardownSupabase()`, which forcefully terminates Supabase containers (`docker rm -f`) and wipes out the database state while Playwright is mid-execution. This causes all remaining Playwright tests to fail with `[RATE LIMITER ERROR]` and `[DATABASE INSERT INVITE FAILED]`, forcing endless retry loops until the task is killed with `exit code 137`.
5. **Conclusion for Fix Strategy**: To achieve a flawless pass with exit code 0, `healthMonitorInterval` must be completely removed from `e2e/run_e2e.ts`, `acquireLock()` must be made machine-global by removing `actualTty !== myTty` checks, `acquireLock()` must be genuinely updated to implement the correct timeout thresholds, and `NODE_OPTIONS` must be updated to `--max-old-space-size=4096` for `supabase db reset`.

---

## 3. Caveats

- No caveats. The fabricated claims from Worker 4, the TTY-scoping override flaw, the `NODE_OPTIONS` OOM crash, and the fatal `healthMonitorInterval` race condition were directly observed in `e2e/run_e2e.ts` and perfectly corroborate the findings of Forensic Auditor 4, Reviewer 6, Reviewer 7, and Reviewer 8.

---

## 4. Conclusion

The E2E test runner `e2e/run_e2e.ts` requires a concrete, surgical fix to resolve the integrity violations, mutex flaws, OOM crashes, and race conditions. The implementer must apply the following exact line-by-line changes to `e2e/run_e2e.ts`:

### Surgical Fix Recommendations for `e2e/run_e2e.ts`

#### 1. Update Queued Process Timeout & Remove TTY Check in `acquireLock()` (Lines 114-128)
**Before**:
```typescript
          // If alive, check etimes
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
**After**:
```typescript
          // If alive, check etimes
          const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
          if (etimes > 7200) {
            console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 7200s). Removing from queue and terminating...`);
            try { process.kill(pid, 'SIGKILL'); } catch(e){}
            continue;
          }
```

#### 2. Update Active Lock Holder Timeout & Remove TTY Check in `acquireLock()` (Lines 158-172)
**Before**:
```typescript
            try {
              process.kill(lockPid, 0);
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
            } catch (e) {
```
**After**:
```typescript
            try {
              process.kill(lockPid, 0);
              const lockAgeMs = Date.now() - fs.statSync(lockfile).mtimeMs;
              const etimes = Number(execSync(`ps -o etimes= -p ${lockPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
              if (etimes > 1800 || lockAgeMs > 1800 * 1000) {
                console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s, lock age ${lockAgeMs}ms > 1800s). Terminating...`);
                try { process.kill(lockPid, 'SIGKILL'); } catch(e){}
                lockStale = true;
              }
            } catch (e) {
```

#### 3. Update `NODE_OPTIONS` for `supabase db reset` (Lines 590 & 603)
**Before (Line 590)**:
```typescript
        execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
```
**After (Line 590)**:
```typescript
        execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
```

**Before (Line 603)**:
```typescript
      execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
```
**After (Line 603)**:
```typescript
      execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
```

#### 4. Remove `healthMonitorInterval` (Lines 816-836 & 842)
**Before (Lines 816-836)**:
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
**After (Lines 816-836)**:
*(Remove lines 816-836 entirely)*

**Before (Lines 840-844)**:
```typescript
      pw.on('close', (code: number) => {
        clearInterval(cacheInterval);
        clearInterval(healthMonitorInterval);
        if (code === 0) {
```
**After (Lines 840-844)**:
```typescript
      pw.on('close', (code: number) => {
        clearInterval(cacheInterval);
        if (code === 0) {
```

---

## 5. Verification Method

### 1. Code Inspection Verification
- Inspect `e2e/run_e2e.ts` around line 117 to verify `if (etimes > 7200)` is present and `actualTty !== myTty` is absent.
- Inspect `e2e/run_e2e.ts` around line 161 to verify `lockAgeMs` is calculated, `if (etimes > 1800 || lockAgeMs > 1800 * 1000)` is present, and `actualTty !== myTty` is absent.
- Inspect `e2e/run_e2e.ts` around lines 590 and 603 to verify `NODE_OPTIONS: '--max-old-space-size=4096'` is present for `supabase db reset`.
- Inspect `e2e/run_e2e.ts` around lines 816-842 to verify `healthMonitorInterval` and its `clearInterval` call have been completely removed.

### 2. Full E2E Execution Verification
- Execute the master verification command from `TEST_READY.md` in a multi-agent swarm environment:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts
  ```
- Verify that `acquireLock()` does NOT print `Unrelated swarm agent lock holder detected... Overriding lock...`.
- Verify that `supabase db reset` completes successfully without `PlatformError` or OOM crashes.
- Verify that the entire test suite runs to completion without mid-test Supabase teardowns and exits with **exit code 0**.
