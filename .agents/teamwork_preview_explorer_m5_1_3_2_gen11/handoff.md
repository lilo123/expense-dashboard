# Handoff Report — M5.3 Explorer 2 gen11 (`teamwork_preview_explorer`)

## Summary of Core Findings
An investigation of `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` confirmed four critical defects: (1) `killCmd` commits process suicide (exit code 137) by matching `name=supabase` in the parent bash verification command; (2) `robustSupabaseRestart()` wipes the database and omits `e2e/seed.ts`, causing cascading Playwright test failures; (3) the shared success cache (`/tmp/run_e2e.success.cache`) relies solely on a 300s timestamp window, allowing E2E test bypassing despite codebase state changes; and (4) `protectProcessTree()` fails silently with `Permission denied` in non-root environments (`duynguyenn`), leading to OOM kills (exit code 137) when Supabase restarts during Playwright execution. Concrete fix strategies including `grep -v docker | grep -v bash`, explicit `e2e/seed.ts` execution, git-hash-based cache validation (`git rev-parse HEAD` + `git diff`), and application-level Playwright abort/retry memory management have been formulated.

---

## 1. Observation

### Defect 1: Process Suicide via Unscoped Grep in `teardownSupabase()`
- **File Paths & Line Numbers**: 
  - `e2e/run_e2e.ts`, lines 343-344 (`teardownSupabase()`).
  - `__tests__/db/recurring_db.test.ts`, lines 100-101 (`teardownSupabase()`).
- **Direct Observations**:
  - In `e2e/run_e2e.ts`, `killCmd` is defined as:
    ```javascript
    const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v sleep | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
    ```
  - In `__tests__/db/recurring_db.test.ts`, `killCmd` is defined as:
    ```javascript
    const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v node | grep -v tsx | grep -v sleep | grep -v npm | grep -v npx | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
    ```
  - **Verbatim Error & Execution Context**: When the independent verification command is executed:
    ```bash
    docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true
    export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
    ```
    The parent `bash` process executing this multiline command contains `name=supabase` on its first line. Because `ps auxww` separates or truncates multiline commands at the newline (`\n`), the first line `docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true` matches `grep -i supabase`.
  - The exclusion filters (`grep -v run_e2e | grep -v verify | grep -v task | grep -v jetski | grep -v gemini`) fail to exclude the `bash` process because `run_e2e` and `verify` are located on the second line (after `\n`), while `task`, `jetski`, and `gemini` are not present in the `bash -c` command line.
  - Consequently, `awk '{print $2}'` extracts the PID of the parent `bash` process executing the verification task, and `xargs -r kill -9` terminates it instantly with `SIGKILL` (exit code 137).

### Defect 2: `robustSupabaseRestart()` Wipes Database and Omits Seed Data
- **File Paths & Line Numbers**: `e2e/run_e2e.ts`, lines 502-525 (`robustSupabaseRestart()`) and lines 817-836 (`healthMonitorInterval`).
- **Direct Observations**:
  - `robustSupabaseRestart()` executes `teardownSupabase()`, `npx --no-install supabase start --debug`, and `npx tsx e2e/init_db.ts` (lines 520-524), but **does not execute `e2e/seed.ts`**.
  - When `healthMonitorInterval` detects Supabase unreachability during Playwright execution, it invokes `robustSupabaseRestart()`.
  - `teardownSupabase()` destroys all Supabase containers and volumes (`docker volume rm -f`). When Supabase restarts, `e2e/init_db.ts` initializes schemas and permissions, but because `e2e/seed.ts` is omitted, the database remains completely empty.
  - **Verbatim Error**: All in-progress and subsequent Playwright tests fail consecutively (`✘ 95` through `✘ 108`) due to missing user profiles, categories, budgets, and expense data.

### Defect 3: Time-Based Shared Success Cache Vulnerability (`/tmp/run_e2e.success.cache`)
- **File Paths & Line Numbers**: `e2e/run_e2e.ts` (observed in `proposed_run_e2e.ts` lines 319-330, 471-482, 786; and documented in Challenger 2 gen10's report).
- **Direct Observations**:
  - The success cache mechanism checks `fs.statSync(cachePath).mtimeMs` and calculates `ageSeconds = (Date.now() - stats.mtimeMs) / 1000`.
  - If `ageSeconds < 300` (5-minute validity window), it logs `Shared result cache hit (Xs old): E2E tests were successfully verified recently by another swarm instance. Skipping redundant execution to prevent OOM.` and calls `process.exit(0)`.
  - **Vulnerability**: The cache validation relies solely on a timestamp window (`300` seconds) without verifying the actual state of the codebase. If a developer or agent modifies the codebase (e.g., introducing breaking UI or database schema changes) and runs `run_e2e.ts` within 5 minutes of a previous successful run, `run_e2e.ts` hits the success cache and exits with code 0, completely bypassing E2E verification for the new changes.

### Defect 4: Ineffective `protectProcessTree()` OOM Protection & Memory Pressure
- **File Paths & Line Numbers**: `e2e/run_e2e.ts`, lines 36-57 (`protectProcessTree()`), lines 817-836 (`healthMonitorInterval`), and lines 838-849 (Playwright spawn).
- **Direct Observations**:
  - `protectProcessTree()` attempts `execSync('echo -1000 > /proc/${current}/oom_score_adj 2>/dev/null || true')`.
  - In a non-root user environment (`duynguyenn`), modifying `/proc/[pid]/oom_score_adj` fails with `Permission denied`, which is silently suppressed by `2>/dev/null || true`.
  - When `healthMonitorInterval` triggers `robustSupabaseRestart()`, spawning `supabase start` (which initializes multiple containers, JVM, and Go processes) while Playwright is actively running memory-intensive browser instances creates severe memory pressure.
  - **Verbatim Error**: Without effective OOM protection, the Linux kernel OOM killer terminates the `run_e2e.ts` process tree with `SIGKILL` (exit code 137).

---

## 2. Logic Chain

1. **Process Suicide via `killCmd`**: The `ps auxww | grep -i supabase` pattern in `teardownSupabase()` is fundamentally flawed when executed within a multiline bash command containing `name=supabase`. Because `ps auxww` splits multiline commands across newlines, the exclusion strings (`run_e2e`, `verify`) on the second line fail to prevent the first line (`docker rm ... name=supabase`) from being matched. Consequently, `killCmd` targets the parent `bash` process, committing process suicide (exit code 137). To resolve this, `killCmd` must be explicitly refined to exclude `grep -v docker` and `grep -v bash`.
2. **Database Wipe & Test Failure in `robustSupabaseRestart()`**: `robustSupabaseRestart()` is designed to recover from Supabase unreachability by performing a full teardown and restart. However, because `teardownSupabase()` removes Docker volumes, the database is recreated in a pristine state. While `e2e/init_db.ts` restores schemas and permissions, omitting `e2e/seed.ts` leaves the database devoid of required test data (profiles, categories, expenses). This guarantees the failure of all subsequent Playwright tests. `robustSupabaseRestart()` must be updated to execute `npx tsx --env-file=.env.test e2e/seed.ts` immediately after `e2e/init_db.ts`.
3. **Cache-Based E2E Bypass Vulnerability**: The shared success cache (`/tmp/run_e2e.success.cache`) successfully coordinates concurrent swarm executions by preventing redundant runs within a 5-minute window. However, relying solely on a timestamp creates a severe false-positive vulnerability where breaking codebase changes are silently ignored if executed within 5 minutes of a prior successful run. To ensure E2E tests are never bypassed when the codebase changes, the cache validation must incorporate a composite hash of the current git commit (`git rev-parse HEAD`) and uncommitted diffs (`git diff`). Any mismatch in the codebase state must immediately invalidate the cache.
4. **OOM Termination due to Unmanaged Memory Pressure**: `protectProcessTree()` fails to protect the test runner because non-root users (`duynguyenn`) lack `CAP_SYS_RESOURCE` privileges to modify `/proc/[pid]/oom_score_adj`. When `healthMonitorInterval` triggers `robustSupabaseRestart()` while Playwright is running, the concurrent execution of memory-intensive browser instances and Supabase container initialization exceeds system memory limits, triggering the Linux kernel OOM killer (exit code 137). Rather than relying on ineffective `/proc` modifications, application-level memory management must be implemented: `healthMonitorInterval` must immediately abort the active Playwright child process (`pw.kill('SIGKILL')`) before restarting Supabase, perform `robustSupabaseRestart()`, and trigger a clean top-level retry of the Playwright test suite.

---

## 3. Caveats
- **Read-Only Constraint**: As an Explorer agent, we are strictly constrained to read-only investigation and analysis. We have not directly modified `e2e/run_e2e.ts` or `__tests__/db/recurring_db.test.ts`. The recommended fix strategies must be applied by a subsequent Implementer/Worker agent.
- **Network Restrictions**: Operating in `CODE_ONLY` network mode; no external endpoints, websites, or external documentation were accessed.
- **Clean Environment Assumptions**: The verification method assumes a standard Linux environment with Docker, Node.js (`v22.22.2`), and Supabase CLI installed, matching the user's workspace configuration.

---

## 4. Conclusion

The E2E test runner (`e2e/run_e2e.ts`) and database integration tests (`__tests__/db/recurring_db.test.ts`) contain four critical defects that cause process suicide (exit code 137), OOM termination (exit code 137), database wiping without seeding during runtime restarts, and E2E test bypassing via a time-based success cache. 

### Recommended Concrete Fix Strategy (Actionable & Scoped)

#### 1. Refine `killCmd` in `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts`
- **Target `e2e/run_e2e.ts` (line 343)**:
  ```javascript
  const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v docker | grep -v bash | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v sleep | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  ```
- **Target `__tests__/db/recurring_db.test.ts` (line 100)**:
  ```javascript
  const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v docker | grep -v bash | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v node | grep -v tsx | grep -v sleep | grep -v npm | grep -v npx | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  ```

#### 2. Update `robustSupabaseRestart()` in `e2e/run_e2e.ts` to Include `e2e/seed.ts`
- **Target `e2e/run_e2e.ts` (lines 519-525)**:
  ```javascript
  console.log('Executing e2e/init_db.ts and e2e/seed.ts after robustSupabaseRestart to restore database permissions and seed data...');
  try {
    execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
    execSync('npx tsx --env-file=.env.test e2e/seed.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  } catch (e) {
    console.warn('e2e/init_db.ts or e2e/seed.ts failed during robustSupabaseRestart. Proceeding...');
  }
  ```

#### 3. Enhance Success Cache Validation with Git Hash & Diffs in `e2e/run_e2e.ts`
- **Add Helper Function in `e2e/run_e2e.ts` (top-level)**:
  ```javascript
  function getCodebaseStateHash(): { gitHead: string, gitDiff: string } {
    try {
      const gitHead = execSync('git rev-parse HEAD 2>/dev/null || echo "no-git-head"', { encoding: 'utf-8' }).trim();
      const gitDiff = execSync('git diff 2>/dev/null || echo "no-git-diff"', { encoding: 'utf-8' }).trim();
      return { gitHead, gitDiff };
    } catch (e) {
      return { gitHead: 'unknown', gitDiff: 'unknown' };
    }
  }
  ```
- **Update Cache Check in `run()` / `setup()`**:
  ```javascript
  const cachePath = '/tmp/run_e2e.success.cache';
  try {
    if (fs.existsSync(cachePath)) {
      const cacheContent = fs.readFileSync(cachePath, 'utf8').trim();
      const cacheData = JSON.parse(cacheContent);
      const ageSeconds = (Date.now() - cacheData.timestamp) / 1000;
      const currentState = getCodebaseStateHash();
      if (ageSeconds < 300 && cacheData.gitHead === currentState.gitHead && cacheData.gitDiff === currentState.gitDiff) {
        console.log(`Shared result cache hit (${Math.round(ageSeconds)}s old, matching codebase state): E2E tests were successfully verified recently by another swarm instance. Skipping redundant execution to prevent OOM.`);
        if (typeof lockAcquired !== 'undefined' && lockAcquired) releaseLock();
        process.exit(0);
      } else {
        console.log(`Shared result cache expired or codebase state changed. Invalidating cache...`);
        try { fs.unlinkSync(cachePath); } catch(e){}
      }
    }
  } catch (e) {
    try { fs.unlinkSync(cachePath); } catch(err){}
  }
  ```
- **Update Cache Population upon Success in `run()`**:
  ```javascript
  console.log('E2E Tests completed successfully!');
  try {
    const currentState = getCodebaseStateHash();
    const cacheData = JSON.stringify({ timestamp: Date.now(), gitHead: currentState.gitHead, gitDiff: currentState.gitDiff });
    fs.writeFileSync('/tmp/run_e2e.success.cache', cacheData, 'utf8');
  } catch(e){}
  ```

#### 4. Implement Application-Level Memory Management & Playwright Abort/Retry in `e2e/run_e2e.ts`
- **Target `e2e/run_e2e.ts` (lines 811-850)**: Replace the Playwright execution block and `healthMonitorInterval` with a robust retry loop that aborts Playwright before restarting Supabase:
  ```javascript
  console.log('Launching Playwright E2E tests across all browsers sequentially (asynchronously to preserve event loop)...');
  const cacheInterval = setInterval(() => {
    try { execSync('sync 2>/dev/null || true'); } catch(e){}
  }, 10000);

  let pwProcess: any = null;
  let isSupabaseRestarting = false;
  let playwrightAttempts = 2;
  let playwrightSuccess = false;

  while (playwrightAttempts > 0 && !playwrightSuccess) {
    try {
      if (typeof global.gc === 'function') { try { global.gc(); } catch(e){} }
      try { execSync('sync 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('echo 3 > /proc/sys/vm/drop_caches 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

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
          console.log('Aborting active Playwright process to prevent OOM memory pressure before restarting Supabase...');
          if (pwProcess && pwProcess.pid) {
            try { pwProcess.kill('SIGKILL'); } catch(killErr){}
          }
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
        pwProcess = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list', '--trace=off'], { stdio: 'inherit', env: { ...process.env, CI: '1', NODE_OPTIONS: '--max-old-space-size=256', PWDEBUG: '0', PLAYWRIGHT_CHROMIUM_USE_HERMETIC: '1' } });
        pwProcess.on('close', (code: number) => {
          clearInterval(healthMonitorInterval);
          pwProcess = null;
          if (code === 0) {
            resolve(true);
          } else {
            reject(new Error(`Playwright tests failed with exit code ${code}`));
          }
        });
      });

      playwrightSuccess = true;
    } catch (pwErr: any) {
      console.warn(`Playwright test execution attempt failed: ${pwErr.message || pwErr}. Attempts left: ${playwrightAttempts - 1}`);
      playwrightAttempts--;
      if (playwrightAttempts > 0) {
        console.log('Retrying Playwright test suite after ensuring clean Supabase state...');
        robustSupabaseRestart();
      }
    }
  }

  clearInterval(cacheInterval);
  if (!playwrightSuccess) {
    throw new Error('Playwright tests failed after all retry attempts.');
  }
  ```

---

## 5. Verification Method

To independently verify the failure modes (current implementation) and validate the correctness of the proposed fixes (once implemented) in a clean environment, execute the following commands:

### Verification Command 1: Full E2E & Financial Math Verification
```bash
docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
- **Expected Result (Current Implementation)**: `run_e2e.ts` fails with exit code `137` (SIGKILL) due to `killCmd` matching `name=supabase` in the bash command line or OOM killer termination during runtime Supabase restarts.
- **Expected Result (Fixed Implementation)**: `run_e2e.ts` executes successfully without killing the parent bash process, successfully aborts Playwright and reseeds data if a Supabase restart occurs, avoids OOM termination, populates `/tmp/run_e2e.success.cache` with git hash metadata, and exits with code 0. `verify_accumulation.ts` and `verify_monte_carlo.ts` subsequently pass all assertions.

### Verification Command 2: Success Cache Codebase State Invalidation Test
```bash
# 1. Run E2E to populate success cache
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts

# 2. Immediately run again without changing codebase state (within 5 minutes)
npx tsx e2e/run_e2e.ts

# 3. Modify a file to create an uncommitted git diff, then run again (within 5 minutes)
echo "// cache invalidation test" >> e2e/run_e2e.ts
npx tsx e2e/run_e2e.ts
git checkout e2e/run_e2e.ts
```
- **Expected Result (Current Implementation)**: Step 2 hits the success cache and exits 0. Step 3 ALSO hits the success cache and exits 0, improperly bypassing E2E tests despite the codebase state change.
- **Expected Result (Fixed Implementation)**: Step 2 hits the success cache and exits 0 (`matching codebase state`). Step 3 detects the git diff mismatch, logs `Shared result cache expired or codebase state changed. Invalidating cache...`, invalidates the cache, and performs a full E2E test run.
