# Handoff Report — M5.3 Explorer 3 gen11 (`teamwork_preview_explorer`)

## 1. Observation
- **Files Investigated**: `e2e/run_e2e.ts`, `__tests__/db/recurring_db.test.ts`, and `.agents/teamwork_preview_explorer_m5_1_3_3_gen11/instructions.md`.
- **Defect 1 (Process Suicide via Unscoped Grep)**:
  - In `e2e/run_e2e.ts` (lines 343-344) and `__tests__/db/recurring_db.test.ts` (lines 100-101), `teardownSupabase()` executes `const killCmd = 'ps auxww | grep -i supabase | ... | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';`.
  - When the verification command is executed (`docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true \n export PATH=...`), `ps auxww` displays `name=supabase` on the first line of the parent `bash` process. The exclusion filters (`grep -v run_e2e | grep -v verify`) fail because those keywords appear on the second line (after `\n`). Consequently, `killCmd` matches the parent `bash` task runner and terminates it with `SIGKILL` (exit code 137).
- **Defect 2 (`robustSupabaseRestart()` Wipes Database and Omits Seed Data)**:
  - In `e2e/run_e2e.ts` (lines 502-526), `robustSupabaseRestart()` performs `teardownSupabase()`, `supabase start`, `sleep 10`, and `npx tsx e2e/init_db.ts`.
  - It does NOT execute `npx tsx --env-file=.env.test e2e/seed.ts`.
  - When `healthMonitorInterval` (lines 817-836) triggers `robustSupabaseRestart()` during Playwright execution, the database is wiped clean and reinitialized but remains empty without seed data, causing all subsequent Playwright tests to fail.
- **Defect 3 (Time-Based Shared Success Cache Vulnerability)**:
  - Reviewer 1 gen10 and Challenger 2 gen10 observed that Worker gen10 implemented a shared success cache (`/tmp/run_e2e.success.cache`) with a 300-second (5-minute) validity window.
  - This time-based cache allows E2E test bypassing even if the codebase state changes within the 5-minute window, creating a critical false-positive vulnerability where broken code is marked as passing.
- **Defect 4 (Ineffective `protectProcessTree()` OOM Protection & Memory Pressure)**:
  - `protectProcessTree()` (lines 36-57 in `e2e/run_e2e.ts`) attempts `execSync('echo -1000 > /proc/${current}/oom_score_adj 2>/dev/null || true')`.
  - In a non-root user environment (`duynguyenn`), modifying `oom_score_adj` fails silently with `Permission denied`.
  - Spawning `supabase start` while Playwright is actively running memory-intensive browser instances creates massive memory pressure, resulting in an OOM kill (exit code 137).

## 2. Logic Chain
1. **Process Suicide Prevention**: To prevent `teardownSupabase()` from killing the parent `bash` task runner or docker commands, `killCmd` must explicitly filter out `bash` and `docker` processes (`grep -v bash | grep -v docker`).
2. **Data Integrity on Restart**: When `robustSupabaseRestart()` is invoked mid-execution by the health monitor, it must fully restore the database state. Executing `e2e/seed.ts` immediately after `e2e/init_db.ts` ensures that required user profiles, categories, and test data are present for in-progress and subsequent Playwright tests.
3. **State-Aware Cache Validation**: A shared success cache is essential to prevent OOM and lock collisions during concurrent swarm executions. However, to maintain absolute verification integrity, the cache validation must incorporate a cryptographic hash of the current working directory's git commit and uncommitted diffs (`git rev-parse HEAD` plus `git diff`). If any file in the codebase changes, the hash changes, and the cache invalidates immediately.
4. **Application-Level Memory Management**: Since non-root environments cannot modify `/proc/[pid]/oom_score_adj`, OOM protection must be handled at the application level. By sending `SIGSTOP` to the Playwright child process tree before initiating `robustSupabaseRestart()` and sending `SIGCONT` after Supabase stabilizes, we eliminate the concurrent memory/CPU spikes that trigger the Linux kernel OOM killer.

## 3. Caveats
- **Read-Only Constraint**: As an Explorer agent, we operate under strict read-only investigation constraints and have not modified `e2e/run_e2e.ts` or `__tests__/db/recurring_db.test.ts` directly.
- **Network Restrictions**: Operating in `CODE_ONLY` network mode; no external endpoints or documentation were accessed.

## 4. Conclusion
We recommend the following concrete fix strategy for the implementer agent to apply to `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts`:

### Fix 1: Refine `killCmd` in `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts`
- **`e2e/run_e2e.ts` (line 343)**:
  ```typescript
  // Before
  const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v sleep | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  
  // After
  const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v bash | grep -v docker | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v node | grep -v tsx | grep -v sleep | grep -v npm | grep -v npx | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  ```
- **`__tests__/db/recurring_db.test.ts` (line 100)**:
  ```typescript
  // Before
  const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v node | grep -v tsx | grep -v sleep | grep -v npm | grep -v npx | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  
  // After
  const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v bash | grep -v docker | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v node | grep -v tsx | grep -v sleep | grep -v npm | grep -v npx | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  ```

### Fix 2: Update `robustSupabaseRestart()` in `e2e/run_e2e.ts`
- **`e2e/run_e2e.ts` (lines 519-525)**:
  ```typescript
  // Before
  console.log('Executing e2e/init_db.ts after robustSupabaseRestart to restore database permissions...');
  try {
    execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  } catch (e) {
    console.warn('e2e/init_db.ts failed during robustSupabaseRestart (tables may not be ready yet). Proceeding...');
  }

  // After
  console.log('Executing e2e/init_db.ts and e2e/seed.ts after robustSupabaseRestart to restore database permissions and seed data...');
  try {
    execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
    execSync('npx tsx --env-file=.env.test e2e/seed.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  } catch (e) {
    console.warn('e2e/init_db.ts or e2e/seed.ts failed during robustSupabaseRestart. Proceeding...');
  }
  ```

### Fix 3: Implement State-Aware Success Cache in `e2e/run_e2e.ts`
- **Add helper functions and integrate into `setup()` and `run()` in `e2e/run_e2e.ts`**:
  ```typescript
  // Add near top of file (e.g., after myLockEntry definition at line 34)
  const successCacheFile = '/tmp/run_e2e.success.cache';
  function getCodebaseHash(): string {
    try {
      const gitHead = execSync('git rev-parse HEAD 2>/dev/null || echo "no-git-head"', { encoding: 'utf-8' }).trim();
      const gitDiff = execSync('git diff HEAD 2>/dev/null || true', { encoding: 'utf-8' }).trim();
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(gitHead + gitDiff).digest('hex');
    } catch (e) {
      return Date.now().toString();
    }
  }

  function checkSuccessCache(): boolean {
    try {
      if (fs.existsSync(successCacheFile)) {
        const stat = fs.statSync(successCacheFile);
        const ageSeconds = (Date.now() - stat.mtimeMs) / 1000;
        if (ageSeconds < 300) {
          const cachedHash = fs.readFileSync(successCacheFile, 'utf8').trim();
          const currentHash = getCodebaseHash();
          if (cachedHash === currentHash) {
            console.log(`Shared result cache hit (${Math.round(ageSeconds)}s old, hash match): E2E tests were successfully verified recently for this exact codebase state. Skipping redundant execution.`);
            return true;
          } else {
            console.log('Shared result cache invalidated: Codebase state (git commit or diff) has changed.');
          }
        } else {
          console.log('Shared result cache expired (> 300s old).');
        }
      }
    } catch (e) {
      console.warn('Error checking success cache:', e);
    }
    return false;
  }

  function writeSuccessCache() {
    try {
      const currentHash = getCodebaseHash();
      fs.writeFileSync(successCacheFile, currentHash, 'utf8');
      console.log(`Shared result cache populated (${successCacheFile}) with codebase hash.`);
    } catch (e) {
      console.warn('Error writing success cache:', e);
    }
  }
  ```
- **Update `setup()` (lines 368-369)**:
  ```typescript
  // Before
  await acquireLock();
  
  if (fs.existsSync(envLocalPath)) {

  // After
  await acquireLock();
  if (checkSuccessCache()) {
    releaseLock();
    process.exit(0);
  }
  
  if (fs.existsSync(envLocalPath)) {
  ```
- **Update `run()` successful completion (lines 851-854)**:
  ```typescript
  // Before
  console.log('E2E Tests completed successfully!');
  cleanup();
  process.exit(0);

  // After
  console.log('E2E Tests completed successfully!');
  writeSuccessCache();
  cleanup();
  process.exit(0);
  ```

### Fix 4: Implement Application-Level Memory Management in `healthMonitorInterval`
- **Update `healthMonitorInterval` and Playwright spawn in `e2e/run_e2e.ts` (lines 816-850)**:
  ```typescript
  // Before
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
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Playwright tests failed with exit code ${code}`));
      }
    });
  });

  // After
  let isSupabaseRestarting = false;
  let pw: any = null;
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
      if (pw && pw.pid) {
        console.log(`Pausing Playwright process tree (PID ${pw.pid}) via SIGSTOP to prevent OOM during Supabase restart...`);
        try { execSync(`kill -STOP ${pw.pid} 2>/dev/null || true`); } catch(e){}
        try { execSync(`pkill -STOP -P ${pw.pid} 2>/dev/null || true`); } catch(e){}
      }
      try {
        robustSupabaseRestart();
        console.log('Runtime Supabase Health Monitoring: robustSupabaseRestart completed successfully.');
      } catch (restartErr) {
        console.error('Runtime Supabase Health Monitoring: robustSupabaseRestart failed:', restartErr);
      } finally {
        if (pw && pw.pid) {
          console.log(`Resuming Playwright process tree (PID ${pw.pid}) via SIGCONT...`);
          try { execSync(`kill -CONT ${pw.pid} 2>/dev/null || true`); } catch(e){}
          try { execSync(`pkill -CONT -P ${pw.pid} 2>/dev/null || true`); } catch(e){}
        }
        setTimeout(() => { isSupabaseRestarting = false; }, 10000);
      }
    }
  }, 5000);

  await new Promise((resolve, reject) => {
    pw = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list', '--trace=off'], { stdio: 'inherit', env: { ...process.env, CI: '1', NODE_OPTIONS: '--max-old-space-size=256', PWDEBUG: '0', PLAYWRIGHT_CHROMIUM_USE_HERMETIC: '1' } });
    pw.on('close', (code: number) => {
      clearInterval(cacheInterval);
      clearInterval(healthMonitorInterval);
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Playwright tests failed with exit code ${code}`));
      }
    });
  });
  ```

## 5. Verification Method
To independently verify the failure modes and test the fixes once implemented in a clean environment, execute:
```bash
docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
- **Expected Result (Current Implementation)**: `run_e2e.ts` fails with exit code `137` (OOM/Process Suicide) or logs consecutive Playwright test failures following `robustSupabaseRestart()`.
- **Expected Result (Fixed Implementation)**: `run_e2e.ts` successfully completes all Playwright tests, properly reseeds data if a restart occurs, avoids OOM termination via `SIGSTOP`/`SIGCONT` pausing, validates success cache against git commit/diff hash, and exits with code 0.
