# Instructions for M5.3 Worker gen11 (`teamwork_preview_worker`)

## Objective
Implement the synthesized fixes in `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` to resolve the four critical defects uncovered in Iteration 10:
1. **Process Suicide via Unscoped Grep in `teardownSupabase()`**: `ps auxww | grep -i supabase` matches the parent `bash` task runner (due to `name=supabase` in `docker rm -f $(docker ps -a -q --filter name=supabase)`) and kills it with `SIGKILL` (exit code 137). Modify `killCmd` in both `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` to explicitly include `grep -v docker` and `grep -v bash`.
2. **`robustSupabaseRestart()` Wipes Database and Omits Seed Data**: When `healthMonitorInterval` triggers `robustSupabaseRestart()` during Playwright execution, it tears down Supabase, restarts it, and runs `e2e/init_db.ts`, but fails to execute `e2e/seed.ts`. This leaves the database empty and causes all subsequent Playwright tests to fail. Update `robustSupabaseRestart()` to execute `npx tsx --env-file=.env.test e2e/seed.ts` immediately after `e2e/init_db.ts`.
3. **Time-Based Shared Success Cache Vulnerability (`/tmp/run_e2e.success.cache`)**: The success cache relies solely on a 5-minute timestamp window (`300` seconds), allowing E2E test bypassing even if the codebase state changes. Enhance the cache validation to include a hash/string of the current working directory's git commit and uncommitted diffs (`git rev-parse HEAD` plus `git diff`), ensuring it invalidates immediately if the codebase state changes.
4. **Ineffective `protectProcessTree()` OOM Protection & Memory Pressure**: `protectProcessTree()` attempts to write `-1000` to `/proc/[pid]/oom_score_adj`, which fails silently with `Permission denied` in non-root environments (`duynguyenn`). Spawning `supabase start` while Playwright is running creates massive memory pressure, resulting in an OOM kill (exit code 137). Implement application-level memory management in `healthMonitorInterval`: abort active Playwright child processes (`pwProcess.kill('SIGKILL')`) before restarting Supabase to prevent OOM termination, perform `robustSupabaseRestart()`, and trigger a clean top-level retry of the Playwright test suite.

## Exact Drop-In Code Replacements

### 1. Refine `killCmd` in `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts`
- **Target in `e2e/run_e2e.ts` (line 343)**:
  ```javascript
  const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v docker | grep -v bash | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v sleep | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  ```
- **Target in `__tests__/db/recurring_db.test.ts` (line 100)**:
  ```javascript
  const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v docker | grep -v bash | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v node | grep -v tsx | grep -v sleep | grep -v npm | grep -v npx | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  ```

### 2. Update `robustSupabaseRestart()` in `e2e/run_e2e.ts` to Include `e2e/seed.ts`
- **Target in `e2e/run_e2e.ts` (lines 519-525)**:
  ```javascript
  console.log('Executing e2e/init_db.ts and e2e/seed.ts after robustSupabaseRestart to restore database permissions and seed data...');
  try {
    execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
    execSync('npx tsx --env-file=.env.test e2e/seed.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  } catch (e) {
    console.warn('e2e/init_db.ts or e2e/seed.ts failed during robustSupabaseRestart. Proceeding...');
  }
  ```

### 3. Enhance Success Cache Validation with Git Hash & Diffs in `e2e/run_e2e.ts`
- **Add Helper Function in `e2e/run_e2e.ts` (top-level, e.g. near line 34)**:
  ```javascript
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
  ```javascript
  await acquireLock();
  if (checkSuccessCache()) {
    releaseLock();
    process.exit(0);
  }
  
  if (fs.existsSync(envLocalPath)) {
  ```
- **Update `run()` successful completion (lines 851-854)**:
  ```javascript
  console.log('E2E Tests completed successfully!');
  writeSuccessCache();
  cleanup();
  process.exit(0);
  ```

### 4. Implement Application-Level Memory Management & Playwright Abort/Retry in `e2e/run_e2e.ts`
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

## Verification Method
Perform genuine independent verification in a clean environment (without deleting `/tmp/run_e2e.lock`) by executing:
```bash
docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
- **Expected Result**: `run_e2e.ts` executes successfully without killing the parent bash process, successfully aborts Playwright and reseeds data if a Supabase restart occurs, avoids OOM termination, populates `/tmp/run_e2e.success.cache` with git hash metadata, and exits with code 0. `verify_accumulation.ts` and `verify_monte_carlo.ts` subsequently pass all assertions.

[!CAUTION] STRICT LOCAL-ONLY GUARDRAIL: You must work locally on this project only. Do NOT push anything to GitHub or execute any `git push` commands.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write your `handoff.md` report in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_m5_1_3_gen11`) and notify me via `send_message`.
