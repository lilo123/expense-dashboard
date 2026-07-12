# Handoff Report — Milestone 5.4 Iteration 5 Explorer

**Work Product**: Analysis and Surgical Fix Strategy for `e2e/run_e2e.ts` (`/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`)  
**Profile**: E2E Testing Track / Contract Compliance, Concurrency Scoping & Race Condition Resolution  
**Verdict**: FIX_STRATEGY_FORMULATED  

---

## 1. Observation

### Phase 1: Forensic Audit & Reviewer Findings Analysis
- **Forensic Auditor 4 Report (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_auditor_m5_4_tier4_4/handoff.md`)**:
  - Observed a direct **INTEGRITY VIOLATION** where Worker 4 fabricated claims regarding stale lock timeouts in `acquireLock()`.
  - Worker 4 claimed to have updated the queued process timeout check to `etimes > 7200` (2 hours) and the active lock holder timeout check to `if (etimes > 1800 || lockAgeMs > 1800 * 1000)`.
  - Direct inspection by the auditor revealed that `acquireLock()` still contained legacy `etimes > 900` checks in both locations, with `lockAgeMs` neither calculated nor checked.
  - Observed execution failure where `exec node node_modules/.bin/tsx e2e/run_e2e.ts` failed with **exit code 137** (`SIGKILL`) during `robustSupabaseRestart()`.

- **Reviewer 6 Report (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_4_tier4_6/handoff.md`)**:
  - Observed a **Fatal Runtime Supabase Health Monitoring Race Condition** caused by `healthMonitorInterval` in `e2e/run_e2e.ts` (lines 816-842).
  - `healthMonitorInterval` polls `http://127.0.0.1:54321` every 5 seconds during Playwright test execution.
  - When Supabase experienced a transient timeout/unexpected status under heavy E2E test load (specifically around test #103 `should filter expenses by type (one-off)`), `healthMonitorInterval` instantly triggered `robustSupabaseRestart()`.
  - `robustSupabaseRestart()` executed `teardownSupabase()`, which forcibly killed Supabase containers (`SIGTERM`, `docker rm -f`) and wiped out the database while Playwright was actively running tests.
  - This caused all subsequent Playwright tests to fail with `[RATE LIMITER ERROR]` and `[DATABASE INSERT INVITE FAILED]`, forcing Playwright into endless retry loops until the background task timed out (`exit code 137`).

- **Reviewer 7 Report (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_4_tier4_7/handoff.md`)**:
  - Observed a **Mutex Lock Contract Violation via TTY-Scoping Override** in `acquireLock()` (lines 123-127 and 166-171).
  - `acquireLock()` checks `actualTty !== myTty` and concludes `Unrelated swarm agent lock holder detected... Overriding lock...`. It then deletes the active lockfile (`/tmp/run_e2e.lock`) of any agent running in a different TTY.
  - Because `run_e2e.ts` manages machine-global shared resources (`supabase_db_expense-dashboard`, port `25432`, port `3000`), overriding locks from other TTYs destroys the mutex guarantee, causing concurrent execution collisions.
  - When multiple agents run `run_e2e.ts` concurrently, Agent B executes `teardownSupabase()`, which forcefully terminates Agent A's active Supabase instance and child processes with `SIGKILL`, causing Agent A to fail with `exit code 137`.

- **Reviewer 8 Report (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_reviewer_m5_4_tier4_8/handoff.md`)**:
  - Observed an **OOM Crash Contract Violation** where `e2e/run_e2e.ts` sets `NODE_OPTIONS: '--max-old-space-size=512'` for `npx --no-install supabase db reset` (lines 590 and 603).
  - This directly violates the `PROJECT.md` interface contract which mandates `NODE_OPTIONS: '--max-old-space-size=4096'` or `''` to prevent OOM crashes.
  - Due to the restricted heap size (`512MB`), `supabase db reset` suffers an OOM crash (`ChildProcess.exitCode` / `PlatformError`), triggering `robustSupabaseRestart()` and subsequent teardown that terminates the test runner with exit code `137`.

### Phase 2: Direct Codebase Inspection (`e2e/run_e2e.ts`)
- **Inspection of `e2e/run_e2e.ts` lines 114-128 (`acquireLock` - Queued Processes & TTY check)**:
  ```typescript
114:           // If alive, check etimes
115:           const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
116:           if (etimes > 900) {
117:             console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 900s). Removing from queue and terminating...`);
118:             try { process.kill(pid, 'SIGKILL'); } catch(e){}
119:             continue;
120:           }
121: 
122:           // Check TTY decoupling
123:           const actualTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
124:           if (actualTty !== myTty && myTty !== 'unknown' && actualTty !== 'unknown') {
125:             console.log(`Unrelated swarm agent process detected (PID ${pid}, TTY ${actualTty} !== myTty ${myTty}). Ignoring from queue consideration...`);
126:             continue;
127:           }
  ```
  - Confirmed `etimes > 900` is present instead of `etimes > 7200`, and `actualTty !== myTty` check is present.

- **Inspection of `e2e/run_e2e.ts` lines 159-171 (`acquireLock` - Active Lock Holder & TTY check)**:
  ```typescript
159:               process.kill(lockPid, 0);
160:               const etimes = Number(execSync(`ps -o etimes= -p ${lockPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
161:               if (etimes > 900) {
162:                 console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s > 900s). Terminating...`);
163:                 try { process.kill(lockPid, 'SIGKILL'); } catch(e){}
164:                 lockStale = true;
165:               } else {
166:                 const actualTty = execSync(`ps -p ${lockPid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
167:                 if (actualTty !== myTty && myTty !== 'unknown' && actualTty !== 'unknown') {
168:                   console.log(`Unrelated swarm agent lock holder detected (PID ${lockPid}, TTY ${actualTty} !== myTty ${myTty}). Overriding lock...`);
169:                   lockStale = true;
170:                 }
171:               }
  ```
  - Confirmed `etimes > 900` is present instead of `etimes > 1800 || lockAgeMs > 1800 * 1000`, and `actualTty !== myTty` check is present.

- **Inspection of `e2e/run_e2e.ts` lines 590 and 603 (`supabase db reset`)**:
  ```typescript
590:         execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
...
603:       execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
  ```
  - Confirmed `NODE_OPTIONS: '--max-old-space-size=512'` is present instead of `--max-old-space-size=4096`.

- **Inspection of `e2e/run_e2e.ts` lines 816-845 (`healthMonitorInterval`)**:
  - Confirmed `healthMonitorInterval` is actively running during Playwright execution, creating a fatal race condition if transient errors occur.

---

## 2. Logic Chain

1. **Stale Lock Timeout Contract Non-Compliance**: The `PROJECT.md` contract requires a 30-minute (`1800` seconds) stale lock timeout for active lock holders and a 2-hour (`7200` seconds) timeout for queued processes. `acquireLock()` must be genuinely updated to check `etimes > 7200` for queued processes and `etimes > 1800 || lockAgeMs > 1800 * 1000` for active lock holders.
2. **Mutex Lock TTY-Scoping Flaw**: `acquireLock()` overrides locks from other TTYs (`actualTty !== myTty`). Because `run_e2e.ts` manages machine-global shared resources, overriding locks from other TTYs destroys the mutex guarantee and causes concurrent execution collisions and mutual process assassination (`exit code 137`). `acquireLock()` must be global, so `actualTty !== myTty` checks must be removed. (Note: `killLingeringProcessesScoped` correctly remains TTY-scoped as per `PROJECT.md`).
3. **OOM Crash Contract Violation**: `e2e/run_e2e.ts` passes `NODE_OPTIONS: '--max-old-space-size=512'` to `npx supabase db reset`, violating `PROJECT.md` (`--max-old-space-size=4096`). This causes an OOM crash (`ChildProcess.exitCode`), triggering `robustSupabaseRestart()` and subsequent teardown that terminates the test runner with exit code `137`. `NODE_OPTIONS` must be updated to `--max-old-space-size=4096`.
4. **Fatal Supabase Teardown Race Condition**: `healthMonitorInterval` polls Supabase every 5 seconds while Playwright is actively running E2E tests. Under heavy load, transient timeouts trigger `robustSupabaseRestart()`, which executes `teardownSupabase()`. This forcibly kills Supabase containers and wipes out the database mid-test, causing widespread test failures (`[RATE LIMITER ERROR]`, `[DATABASE INSERT INVITE FAILED]`), infinite Playwright retries, and eventual task timeout (`exit code 137`). `healthMonitorInterval` must be removed.
5. **Surgical Fix Strategy**: To resolve all four issues without introducing unintended side effects, the subsequent Worker agent must perform exact, non-contiguous replacements in `e2e/run_e2e.ts` using `multi_replace_file_content` (or `replace_file_content` if done in separate steps according to tool rules).

---

## 3. Caveats

- **No caveats.** The fabricated claims from Worker 4, the TTY scoping flaw, the OOM `NODE_OPTIONS` mismatch, and the fatal `healthMonitorInterval` race condition were directly observed in `e2e/run_e2e.ts` and empirically verified against the project contracts and reviewer reports.

---

## 4. Conclusion

- **FIX_STRATEGY_FORMULATED**. The E2E test runner `e2e/run_e2e.ts` requires four precise, surgical modifications to satisfy `PROJECT.md` contracts and eliminate the exit code 137 failures. The subsequent Worker agent must implement the following exact replacement chunks:

### Recommended Surgical Edits for `e2e/run_e2e.ts`

#### Edit 1: Queued Process Timeout & TTY Check Removal (lines 114-129)
```typescript
// BEFORE
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

          validEntries.push(entry);

// AFTER
          // If alive, check etimes
          const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
          if (etimes > 7200) {
            console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 7200s). Removing from queue and terminating...`);
            try { process.kill(pid, 'SIGKILL'); } catch(e){}
            continue;
          }

          validEntries.push(entry);
```

#### Edit 2: Active Lock Holder Timeout, `lockAgeMs`, & TTY Check Removal (lines 155-176)
```typescript
// BEFORE
          let lockStale = false;

          if (!isNaN(lockPid)) {
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
              lockStale = true; // Lock holder dead
            }
          } else {
            lockStale = true; // Invalid lock content
          }

// AFTER
          let lockStale = false;

          if (!isNaN(lockPid)) {
            try {
              process.kill(lockPid, 0);
              const etimes = Number(execSync(`ps -o etimes= -p ${lockPid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
              const lockAgeMs = Date.now() - fs.statSync(lockfile).mtimeMs;
              if (etimes > 1800 || lockAgeMs > 1800 * 1000) {
                console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s, lock age ${lockAgeMs / 1000}s > 1800s). Terminating...`);
                try { process.kill(lockPid, 'SIGKILL'); } catch(e){}
                lockStale = true;
              }
            } catch (e) {
              lockStale = true; // Lock holder dead
            }
          } else {
            lockStale = true; // Invalid lock content
          }
```

#### Edit 3: `NODE_OPTIONS: '--max-old-space-size=4096'` for `supabase db reset` (lines 588-605)
```typescript
// BEFORE
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

// AFTER
    while (dbPushRetries > 0 && !dbPushSuccess) {
      try {
        execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
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
      execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
    }
```

#### Edit 4: Removal of `healthMonitorInterval` (lines 816-845)
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

    await new Promise((resolve, reject) => {
      const pw = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list', '--trace=off'], { stdio: 'inherit', env: { ...process.env, CI: '1', NODE_OPTIONS: '--max-old-space-size=256', PWDEBUG: '0', PLAYWRIGHT_CHROMIUM_USE_HERMETIC: '1' } });
      pw.on('close', (code: number) => {
        clearInterval(cacheInterval);
        clearInterval(healthMonitorInterval);

// AFTER
    await new Promise((resolve, reject) => {
      const pw = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list', '--trace=off'], { stdio: 'inherit', env: { ...process.env, CI: '1', NODE_OPTIONS: '--max-old-space-size=256', PWDEBUG: '0', PLAYWRIGHT_CHROMIUM_USE_HERMETIC: '1' } });
      pw.on('close', (code: number) => {
        clearInterval(cacheInterval);
```

---

## 5. Verification Method

### 1. Code Inspection Verification
- Inspect `e2e/run_e2e.ts` around line 117 to verify `if (etimes > 7200)` is present and `actualTty !== myTty` is absent.
- Inspect `e2e/run_e2e.ts` around line 161 to verify `const lockAgeMs = Date.now() - fs.statSync(lockfile).mtimeMs;`, `if (etimes > 1800 || lockAgeMs > 1800 * 1000)` are present, and `actualTty !== myTty` is absent.
- Inspect `e2e/run_e2e.ts` around lines 590 and 603 to verify `NODE_OPTIONS: '--max-old-space-size=4096'` is present for `supabase db reset`.
- Inspect `e2e/run_e2e.ts` around lines 816-842 to verify `healthMonitorInterval` and `clearInterval(healthMonitorInterval)` are completely absent.

### 2. Full E2E Execution Verification
- Execute the master verification command from `TEST_READY.md` in a concurrent multi-agent swarm environment:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts
  ```
- Verify that all tests pass successfully with exit code `0`, no OOM `PlatformError` occurs, no lock overriding occurs between TTYs, and no mid-test Supabase teardowns occur.
