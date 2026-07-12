# Handoff Report — M5.3 Explorer 1 gen11 (`teamwork_preview_explorer`)

## 1. Observation
- **Files Investigated**: `e2e/run_e2e.ts`, `__tests__/db/recurring_db.test.ts`, and `instructions.md`.
- **Defect 1: Process Suicide via Unscoped Grep in `teardownSupabase()`**:
  - In `e2e/run_e2e.ts` (lines 343-344) and `__tests__/db/recurring_db.test.ts` (lines 100-101), `teardownSupabase()` executes:
    ```javascript
    const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v sleep | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
    try { execSync(killCmd, { stdio: 'inherit' }); } catch(e){}
    ```
  - As observed in Reviewer 1 gen10 and Challenger 1 gen10 reports, when the verification command `docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true\nexport PATH=$PATH:... && npx tsx e2e/run_e2e.ts ...` is executed, `ps auxww` includes the parent `bash` task runner whose command line contains `name=supabase`.
  - Because `ps auxww` separates multiline commands or truncates long argument lists, the first line (`docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true`) matches `grep -i supabase` but fails the exclusion filters (`grep -v run_e2e`, `grep -v verify`, etc.) because those strings appear on the second line after `\n`.
  - Consequently, `awk '{print $2}' | xargs -r kill -9` terminates the parent `bash` process with `SIGKILL` (exit code 137).

- **Defect 2: `robustSupabaseRestart()` Wipes Database and Omits Seed Data**:
  - In `e2e/run_e2e.ts` (lines 502-525), `robustSupabaseRestart()` calls `teardownSupabase()`, `supabase start`, and `e2e/init_db.ts`, but **does not execute `e2e/seed.ts`**.
  - In `e2e/run_e2e.ts` (lines 817-836), `healthMonitorInterval` monitors Supabase health every 5 seconds during Playwright test execution. If Supabase becomes unreachable, it invokes `robustSupabaseRestart()`.
  - Reviewer 1 gen10 observed that immediately following `robustSupabaseRestart()`, all in-progress Playwright tests failed consecutively (`✘ 95` through `✘ 108`) because the database was wiped clean and never reseeded.

- **Defect 3: Time-Based Shared Success Cache Vulnerability (`/tmp/run_e2e.success.cache`)**:
  - In `proposed_run_e2e.ts` (lines 319-330 & 471-482) and as audited by Challenger 2 gen10, the success cache mechanism checks if `/tmp/run_e2e.success.cache` exists and is less than 300 seconds (5 minutes) old:
    ```javascript
    const stats = fs.statSync(cachePath);
    const ageSeconds = (Date.now() - stats.mtimeMs) / 1000;
    if (ageSeconds < 300) { ... process.exit(0); }
    ```
  - This validation relies solely on a timestamp window, allowing E2E test bypassing even if the codebase state (git commit or uncommitted diffs) changes within those 5 minutes.

- **Defect 4: Ineffective `protectProcessTree()` OOM Protection & Memory Pressure**:
  - In `e2e/run_e2e.ts` (lines 36-57), `protectProcessTree()` attempts:
    ```javascript
    execSync(`echo -1000 > /proc/${current}/oom_score_adj 2>/dev/null || true`);
    ```
  - In a non-root user environment (`duynguyenn`), modifying `/proc/[pid]/oom_score_adj` fails with `Permission denied`, which is silently suppressed by `2>/dev/null || true`.
  - Spawning `supabase start` (which initializes multiple containers and JVM/Go processes) while Playwright is actively running memory-intensive browser instances creates massive memory pressure, resulting in the Linux kernel OOM killer terminating `run_e2e.ts` with exit code 137.

## 2. Logic Chain
1. **Process Suicide via Unscoped Grep**: The `ps auxww | grep -i supabase` command is overly broad. When executed within a multiline `bash` command containing `name=supabase`, `ps auxww` splits the command across lines. The exclusion filters (`grep -v run_e2e`, etc.) fail to match the first line, causing `killCmd` to target the parent `bash` process PID. Adding `grep -v docker` and `grep -v bash` to `killCmd` in both `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` will prevent matching the parent task runner or Docker filter commands.
2. **Database Wipe without Seed Data**: `robustSupabaseRestart()` completely recreates the Supabase containers. While `e2e/init_db.ts` restores schemas and permissions, omitting `e2e/seed.ts` leaves tables empty. When `healthMonitorInterval` triggers a restart mid-execution, active Playwright tests fail due to missing profiles, categories, and expenses. Updating `robustSupabaseRestart()` to explicitly execute `npx tsx --env-file=.env.test e2e/seed.ts` immediately after `e2e/init_db.ts` ensures data continuity.
3. **Time-Based Cache Vulnerability**: A 5-minute timestamp window for `/tmp/run_e2e.success.cache` cannot detect codebase changes. If a breaking change is introduced within 5 minutes of a successful run, the E2E runner exits with code 0 without testing the new state. Enhancing the cache payload to include a hash of `git rev-parse HEAD` and `git diff` ensures the cache invalidates instantly upon any codebase modification.
4. **Ineffective OOM Protection & Memory Pressure**: Non-root processes cannot set `oom_score_adj` to `-1000`. Silently ignoring this failure leaves the test runner vulnerable to the Linux kernel OOM killer. When `healthMonitorInterval` triggers `robustSupabaseRestart()` while Playwright is running, the concurrent memory demands of browser instances and Supabase container initialization exceed system limits. Implementing application-level memory management—such as pausing or aborting Playwright during a Supabase restart, and tuning Node/Supabase memory limits—is necessary to prevent OOM termination (exit code 137).

## 3. Caveats
- **Read-Only Investigation**: As an Explorer agent, we are strictly constrained to read-only analysis and cannot directly modify `e2e/run_e2e.ts` or `__tests__/db/recurring_db.test.ts`. The recommended fix strategy must be implemented by a subsequent Worker agent.
- **Network Restrictions**: Operating in `CODE_ONLY` network mode; no external endpoints or documentation were accessed.

## 4. Conclusion
The four critical defects in `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts` can be robustly resolved by implementing the following concrete fix strategy:

### Concrete Fix Strategy

#### 1. Refine `killCmd` in `e2e/run_e2e.ts` and `__tests__/db/recurring_db.test.ts`
Modify `killCmd` in both files to explicitly include `grep -v docker` and `grep -v bash`.
- **Target in `e2e/run_e2e.ts` (line 343)**:
  ```javascript
  const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v docker | grep -v bash | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v sleep | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  ```
- **Target in `__tests__/db/recurring_db.test.ts` (line 100)**:
  ```javascript
  const killCmd = 'ps auxww | grep -i supabase | grep -v grep | grep -v docker | grep -v bash | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_ | grep -v stress_test_ | grep -v playwright | grep -v next | grep -v node | grep -v tsx | grep -v sleep | grep -v npm | grep -v npx | grep -v jest | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true';
  ```

#### 2. Update `robustSupabaseRestart()` to Execute `e2e/seed.ts`
Modify `robustSupabaseRestart()` in `e2e/run_e2e.ts` (lines 502-525) to run `e2e/seed.ts` immediately after `e2e/init_db.ts`.
- **Target in `e2e/run_e2e.ts` (lines 520-525)**:
  ```javascript
  console.log('Executing e2e/init_db.ts after robustSupabaseRestart to restore database permissions...');
  try {
    execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  } catch (e) {
    console.warn('e2e/init_db.ts failed during robustSupabaseRestart (tables may not be ready yet). Proceeding...');
  }
  console.log('Executing e2e/seed.ts after robustSupabaseRestart to restore seed data...');
  try {
    execSync('npx tsx --env-file=.env.test e2e/seed.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  } catch (e) {
    console.warn('e2e/seed.ts failed during robustSupabaseRestart. Proceeding...');
  }
  ```

#### 3. Enhance Shared Success Cache Validation with Git State Hash
Update the success cache logic in `e2e/run_e2e.ts` to store and verify a hash/string of `git rev-parse HEAD` and `git diff`.
- **Target in `e2e/run_e2e.ts` (`run()` cache check at start)**:
  ```javascript
  const cachePath = '/tmp/run_e2e.success.cache';
  try {
    if (fs.existsSync(cachePath)) {
      const cachedContent = fs.readFileSync(cachePath, 'utf8').trim();
      const stats = fs.statSync(cachePath);
      const ageSeconds = (Date.now() - stats.mtimeMs) / 1000;
      if (ageSeconds < 300) { // 5 minutes validity window
        const currentGitState = execSync('git rev-parse HEAD 2>/dev/null || true', { encoding: 'utf8' }).trim() + '_' + execSync('git diff 2>/dev/null || true', { encoding: 'utf8' }).trim();
        if (cachedContent === currentGitState) {
          console.log(`Shared result cache hit (${Math.round(ageSeconds)}s old, matching git state): E2E tests were successfully verified recently by another swarm instance. Skipping redundant execution to prevent OOM.`);
          if (typeof lockAcquired !== 'undefined' && lockAcquired) releaseLock();
          process.exit(0);
        } else {
          console.log('Shared result cache invalidated due to codebase state changes (git commit/diff mismatch).');
        }
      }
    }
  } catch (e) {}
  ```
- **Target in `e2e/run_e2e.ts` (`run()` cache write upon success, line 786 in proposed / end of run)**:
  ```javascript
  try {
    const currentGitState = execSync('git rev-parse HEAD 2>/dev/null || true', { encoding: 'utf8' }).trim() + '_' + execSync('git diff 2>/dev/null || true', { encoding: 'utf8' }).trim();
    fs.writeFileSync('/tmp/run_e2e.success.cache', currentGitState, 'utf8');
  } catch(e){}
  ```

#### 4. Implement Application-Level Memory Management & OOM Mitigation
Since `oom_score_adj` fails silently in non-root environments, prevent OOM kills by ensuring Playwright and `supabase start` do not collide destructively during runtime health monitoring.
- **Target in `e2e/run_e2e.ts` (`healthMonitorInterval`, lines 817-836)**:
  Instead of blindly restarting Supabase while Playwright is actively consuming memory, pause/kill Playwright before restarting Supabase, or gracefully abort the test run to trigger a clean top-level retry.
  ```javascript
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
        console.log('Stopping active Playwright processes to relieve memory pressure before Supabase restart...');
        try { execSync('pkill -9 -f playwright 2>/dev/null || true'); } catch(e){}
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

## 5. Verification Method
To independently verify the failure modes and test the implemented fixes in a clean environment, execute:
```bash
docker rm -f $(docker ps -a -q --filter name=supabase) 2>/dev/null || true
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
- **Expected Result (Current Implementation)**: `run_e2e.ts` fails with exit code `137` (OOM/Process Suicide) or logs consecutive Playwright test failures following `robustSupabaseRestart()`.
- **Expected Result (Fixed Implementation)**: `run_e2e.ts` successfully completes all Playwright tests without process suicide, properly reseeds data if a restart occurs, avoids OOM termination, correctly invalidates the success cache on codebase changes, and exits with code 0.
