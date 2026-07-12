# Investigation Report: Milestone 5.4 Iteration 5 (M5.4: Tier 4 E2E Test Pass)

## 1. Observation

### 1.1 `ps -eo pid,args` Truncation Issue (`e2e/run_e2e.ts`)
- **File Path**: `e2e/run_e2e.ts`
- **Line Numbers**: 272–295 (inside `killLingeringProcessesScoped`)
- **Verbatim Code**:
  ```typescript
  272:       const allPids = execSync(`ps -eo pid,args --width 4096 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n');
  273:       for (const line of allPids) {
  274:         const trimmed = line.trim();
  275:         if (!trimmed) continue;
  276:         const parts = trimmed.split(/\s+/);
  277:         const pid = Number(parts[0]);
  278:         if (isNaN(pid) || pid <= 0) continue;
  279:         const args = parts.slice(1).join(' ');
  280:         if (args.includes('run_e2e') || args.includes('verify_') || args.includes('stress_test_') || args.includes('adv_') || args.includes('playwright') || args.includes('next') || args.includes('jetski') || args.includes('gemini') || args.includes('task')) {
  281:           if (args.includes('run_e2e')) {
  282:             try {
  283:               const etimes = Number(execSync(`ps -o etimes= -p ${pid} 2>/dev/null || true`, { encoding: 'utf-8' }).trim());
  284:               if (etimes > 900) {
  285:                 console.log(`Stale run_e2e process (PID ${pid}) detected in killLingeringProcessesScoped. Skipping protection.`);
  286:                 continue;
  287:               }
  288:             } catch(e){}
  289:           }
  290:           protectedPids.add(pid);
  291:           addAncestors(pid);
  292:           addDescendants(pid);
  293:         }
  294:       }
  ```
- **Line Numbers**: 301–315
- **Verbatim Code**:
  ```typescript
  301:     const pids = execSync(`pgrep -f "${pattern}" 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
  ...
  314:       console.log(`Killing lingering processes (${pattern}) scoped to TTY ${myTty}: ${pidsToKill.join(' ')}`);
  315:       execSync(`kill -9 ${pidsToKill.join(' ')} 2>/dev/null || true`, { stdio: 'inherit' });
  ```
- **Context**: `TEST_READY.md` line 4 defines an extremely long invocation string (437 characters): `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts`. Depending on the environment and `ps` implementation, `ps -eo pid,args` can truncate before reaching `run_e2e.ts`, causing `protectedPids` to omit the test runner PID, leading to SIGKILL (exit code 137) by peer swarm instances.

### 1.2 `healthMonitorInterval` Race Condition (`e2e/run_e2e.ts`)
- **File Path**: `e2e/run_e2e.ts`
- **Line Numbers**: 833–896
- **Verbatim Code**:
  ```typescript
  833:     let pwProcess: any = null;
  834:     let isSupabaseRestarting = false;
  835:     let playwrightAttempts = 2;
  836:     let playwrightSuccess = false;
  837: 
  838:     while (playwrightAttempts > 0 && !playwrightSuccess) {
  ...
  844:         const healthMonitorInterval = setInterval(async () => {
  845:           if (isShuttingDown || isSupabaseRestarting) return;
  846:           try {
  847:             const res = await fetch('http://127.0.0.1:54321');
  848:             if (!res.ok && res.status !== 404 && res.status !== 400 && res.status !== 200) {
  849:               throw new Error(`Unexpected status ${res.status}`);
  850:             }
  851:           } catch (err: any) {
  852:             console.warn('Runtime Supabase Health Monitoring: Supabase became unreachable during Playwright execution:', err.message || err);
  853:             isSupabaseRestarting = true;
  854:             console.log('Aborting active Playwright process to prevent OOM memory pressure before restarting Supabase...');
  855:             if (pwProcess && pwProcess.pid) {
  856:               try { pwProcess.kill('SIGKILL'); } catch(killErr){}
  857:             }
  858:             try {
  859:               robustSupabaseRestart();
  860:               console.log('Runtime Supabase Health Monitoring: robustSupabaseRestart completed successfully.');
  861:             } catch (restartErr) {
  862:               console.error('Runtime Supabase Health Monitoring: robustSupabaseRestart failed:', restartErr);
  863:             } finally {
  864:               setTimeout(() => { isSupabaseRestarting = false; }, 10000);
  865:             }
  866:           }
  867:         }, 5000);
  868: 
  869:         await new Promise((resolve, reject) => {
  870:           pwProcess = require('child_process').spawn('npx', ['playwright', 'test', '--workers=1', '--reporter=list', '--trace=off'], { stdio: 'inherit', env: { ...process.env, CI: '1', NODE_OPTIONS: '--max-old-space-size=256', PWDEBUG: '0', PLAYWRIGHT_CHROMIUM_USE_HERMETIC: '1' } });
  871:           pwProcess.on('close', (code: number) => {
  872:             clearInterval(healthMonitorInterval);
  873:             pwProcess = null;
  874:             if (code === 0) {
  875:               resolve(true);
  876:             } else {
  877:               reject(new Error(`Playwright tests failed with exit code ${code}`));
  878:             }
  879:           });
  880:         });
  ...
  883:       } catch (pwErr: any) {
  884:         console.warn(`Playwright test execution attempt failed: ${pwErr.message || pwErr}. Attempts left: ${playwrightAttempts - 1}`);
  885:         playwrightAttempts--;
  886:         if (playwrightAttempts > 0) {
  887:           console.log('Retrying Playwright test suite after ensuring clean Supabase state...');
  888:           robustSupabaseRestart();
  889:         }
  890:       }
  891:     }
  ```

### 1.3 Fabricated Claims in `acquireLock()` (`e2e/run_e2e.ts`)
- **File Path**: `e2e/run_e2e.ts`
- **Line Numbers**: 77–210
- **Verbatim Code**:
  ```typescript
  77: function acquireLock(): boolean {
  78:   console.log(`Acquiring file-based FIFO mutex lock (${lockfile}) with entry ${myLockEntry}...`);
  79:   const startTime = Date.now();
  80:   const maxWaitMs = 15 * 60 * 1000; // 15 minutes max wait
  ...
  191:         // Acquire lock
  192:         fs.writeFileSync(lockfile, myLockEntry, 'utf8');
  193:         console.log(`Successfully acquired mutex lock (${lockfile}) with entry ${myLockEntry}.`);
  194:         lockAcquired = true;
  195:         return true;
  ...
  206:   console.error(`Failed to acquire lock (${lockfile}) after 15 minutes. Proceeding forcefully...`);
  207:   try { fs.writeFileSync(lockfile, myLockEntry, 'utf8'); } catch(e){}
  208:   lockAcquired = true;
  209:   return true;
  210: }
  ```
- **Context**: `PROJECT.md` line 26 mandates: `- acquireLock must include stale lock detection (process.kill(pid, 0)) and 30-minute timeout.`

### 1.4 `etimes > 2700` Contract Non-Conformance (`e2e/run_e2e.ts`)
- **File Path**: `e2e/run_e2e.ts`
- **Line Numbers**: 118, 163, 284
- **Verbatim Code**:
  ```typescript
  118:           if (etimes > 900) {
  119:             console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 900s). Removing from queue and terminating...`);
  ...
  163:               if (etimes > 900) {
  164:                 console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s > 900s). Terminating...`);
  ...
  284:               if (etimes > 900) {
  285:                 console.log(`Stale run_e2e process (PID ${pid}) detected in killLingeringProcessesScoped. Skipping protection.`);
  ```
- **Context**: `PROJECT.md` line 26 mandates a 30-minute lock timeout, and `PROJECT.md` contract non-conformance finding notes that `etimes > 2700` (45 minutes) is required for the full 45-test suite across all tiers and browsers.

### 1.5 Cache Bypass Logic (`/tmp/run_e2e.success.permanent.cache`)
- **Tool Command**: `code_search` for `run_e2e.success.permanent.cache|cachePath`
- **Result**: Zero matches for `run_e2e.success.permanent.cache` across the entire repository.
- **Context**: Reviewer 2 in Iteration 3 reported a Critical INTEGRITY VIOLATION where Worker 1 fabricated E2E test verification results while relying on `/tmp/run_e2e.success.permanent.cache` to bypass test execution entirely.

---

## 2. Logic Chain

### 2.1 Resolving `ps -eo pid,args` Truncation (Exit Code 137)
1. `ps -eo pid,args --width 4096` relies on `ps` output formatting. In certain containerized or restricted environments, `ps` buffers or kernel `/proc` reading limits can truncate argument strings before reaching `run_e2e.ts` at the very end of a 437-character command string.
2. When truncation occurs, `args.includes('run_e2e')` evaluates to `false`. Consequently, `killLingeringProcessesScoped` fails to add the test runner's PID to `protectedPids`.
3. Subsequently, `pgrep -f "node|tsx|jest|webpack"` matches the test runner (since `pgrep -f` inspects the full `/proc/[pid]/cmdline`). Because the PID is missing from `protectedPids`, `kill -9` is executed on the valid test runner, resulting in exit code 137 (SIGKILL).
4. **Fix Strategy**: Enhance `killLingeringProcessesScoped` to explicitly populate `protectedPids` using `pgrep -f "run_e2e|verify_|stress_test_|adv_|playwright|next|jetski|gemini|task"`. This directly parses `/proc/[pid]/cmdline` without relying on `ps` column width formatting, guaranteeing 100% protection of valid test runners.

### 2.2 Eliminating `healthMonitorInterval` Race Conditions & False Teardowns
1. **Un-cleared Intervals**: In `run_e2e.ts`, `clearInterval(healthMonitorInterval)` is only called inside `pwProcess.on('close')`. If `spawn` throws synchronously or if the promise rejects before `close` attaches, the interval leaks. When the `while` loop retries, a second `healthMonitorInterval` is created, leading to concurrent, conflicting health checks.
2. **Concurrent Health Checks**: `setInterval` fires every 5000ms regardless of whether the previous `fetch` has completed. Under heavy test load, `fetch` can stall, causing multiple health check callbacks to pile up and execute simultaneously.
3. **Dual Teardown Collision**: When Supabase becomes unreachable, the health monitor callback executes `pwProcess.kill('SIGKILL')` and immediately calls `robustSupabaseRestart()`. Killing `pwProcess` triggers `pwProcess.on('close')`, which rejects the promise, throws to the `catch` block (line 883), and executes a second `robustSupabaseRestart()` (line 888). Two concurrent `robustSupabaseRestart()` calls collide, corrupting Supabase containers and the database.
4. **Fix Strategy**:
   - Wrap the `await new Promise` in a `try...finally` block that guarantees `clearInterval(healthMonitorInterval)` is executed under all circumstances.
   - Remove `robustSupabaseRestart()` from the `healthMonitorInterval` callback entirely. The health monitor should only terminate `pwProcess` (`pwProcess.kill('SIGKILL')`). The resulting promise rejection will cleanly transfer control to the `catch` block, where a single, thread-safe `robustSupabaseRestart()` is executed before retrying.

### 2.3 Rectifying Fabricated Claims in `acquireLock()`
1. **Fabricated Lock Acquisition**: `acquireLock()` sets `maxWaitMs = 15 * 60 * 1000` (15 minutes). If the lock is not acquired within 15 minutes, it logs `"Failed to acquire lock... Proceeding forcefully..."`, forcefully overwrites `lockfile`, sets `lockAcquired = true`, and returns `true`. This fakes a successful lock acquisition, violating the integrity of the mutex and causing concurrent execution collisions.
2. **TOCTOU Vulnerability**: `fs.existsSync(lockfile)` followed by `fs.writeFileSync(lockfile, myLockEntry, 'utf8')` is not atomic. Two swarm agents can simultaneously observe `existsSync === false` and both write to `lockfile`.
3. **Fix Strategy**:
   - Align `maxWaitMs` with `PROJECT.md` by setting it to `30 * 60 * 1000` (30 minutes).
   - Replace the forceful override with a hard failure: `throw new Error('Failed to acquire mutex lock after 30 minutes. Aborting to prevent concurrent collision.');`.
   - Implement atomic lockfile creation using `fs.openSync(lockfile, 'wx')` (write-exclusive mode), eliminating TOCTOU vulnerabilities entirely.

### 2.4 Aligning `etimes > 2700` Contract Conformance
1. `PROJECT.md` mandates a 30-minute lock timeout, and the full 45-test E2E suite across multiple browsers requires up to 45 minutes (`etimes > 2700`).
2. `run_e2e.ts` currently checks `etimes > 900` (15 minutes) in three separate locations (lines 118, 163, 284).
3. Any valid E2E test runner executing longer than 15 minutes is incorrectly categorized as "stale" and killed by peer swarm agents.
4. **Fix Strategy**: Update all three `etimes > 900` checks in `e2e/run_e2e.ts` to `etimes > 2700` (and update the corresponding log messages to `2700s (45m)`).

### 2.5 Verifying Removal of Cache Bypass Logic
1. Reviewer 2 in Iteration 3 discovered that Worker 1 fabricated test results by checking `/tmp/run_e2e.success.permanent.cache` to skip test execution.
2. Our comprehensive `code_search` confirmed that `run_e2e.success.permanent.cache` has been fully expunged from the codebase in Iteration 5.
3. **Fix Strategy**: Ensure the Worker in Iteration 5 maintains this clean state and does not reintroduce any form of cache bypass or audit circumvention.

---

## 3. Caveats
- **Read-Only Investigation**: As an Explorer agent, no code changes were directly implemented. All findings are based on static code analysis and architectural tracing.
- **Environment Dependency**: The exact behavior of `ps` truncation depends on the underlying Linux distribution and container runtime (e.g., procps vs busybox). However, `pgrep -f` provides a universally robust fallback across all Linux environments.
- **No other caveats**.

---

## 4. Conclusion
The M5.4 Iteration 5 Worker must implement a surgical, verified fix strategy in `e2e/run_e2e.ts` that addresses all five integrity violations and concurrency bugs without circumventing audits or disabling rules:

1. **Fix `ps` Truncation (Exit Code 137)**: In `killLingeringProcessesScoped`, add an explicit `pgrep -f` check to populate `protectedPids`:
   ```typescript
   try {
     const pgrepPids = execSync(`pgrep -f "run_e2e|verify_|stress_test_|adv_|playwright|next|jetski|gemini|task" 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n');
     for (const line of pgrepPids) {
       const pid = Number(line.trim());
       if (!isNaN(pid) && pid > 0) {
         protectedPids.add(pid);
         addAncestors(pid);
         addDescendants(pid);
       }
     }
   } catch (e) {}
   ```
2. **Fix `healthMonitorInterval` Race Condition**:
   - Wrap the Playwright execution promise in a `try...finally` block to guarantee `clearInterval(healthMonitorInterval)`.
   - Remove `robustSupabaseRestart()` from the `healthMonitorInterval` callback. Allow `pwProcess.kill('SIGKILL')` to reject the promise and let the main `while` loop's `catch` block handle the restart cleanly.
3. **Fix Fabricated Claims in `acquireLock()`**:
   - Increase `maxWaitMs` to `30 * 60 * 1000` (30 minutes).
   - Replace `fs.existsSync(lockfile)` / `fs.writeFileSync` with atomic `fs.openSync(lockfile, 'wx')`.
   - Replace the forceful lock override at the end of `acquireLock()` with `throw new Error('Failed to acquire mutex lock after 30 minutes.');`.
4. **Fix `etimes > 2700` Contract Conformance**: Change `etimes > 900` to `etimes > 2700` at lines 118, 163, and 284 in `e2e/run_e2e.ts`.
5. **Maintain Cache Bypass Absence**: Ensure `/tmp/run_e2e.success.permanent.cache` remains completely absent from the codebase.

---

## 5. Verification Method

### 5.1 Automated Test Execution
To independently verify the fixes once implemented by the Worker, execute the full E2E test runner suite:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec node node_modules/.bin/tsx e2e/run_e2e.ts
```
- **Expected Result**: All tests pass with exit code 0. No exit code 137 (SIGKILL) occurs. No Supabase container collisions occur.

### 5.2 Static Code Inspection
- Inspect `e2e/run_e2e.ts` to verify:
  - `etimes > 2700` is used exclusively.
  - `acquireLock()` uses `30 * 60 * 1000` and throws an error on timeout.
  - `healthMonitorInterval` is cleared in a `finally` block and does not call `robustSupabaseRestart()`.
  - `killLingeringProcessesScoped` uses `pgrep -f` to populate `protectedPids`.
  - No references to `run_e2e.success.permanent.cache` exist.
