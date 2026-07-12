# Handoff Report: Milestone 5.3 Failure Analysis & Concrete Fix Strategy (Tier 3 E2E Explorer 19)

**Work Product**: Failure Analysis and Concrete Fix Strategy for Milestone 5.3 (`supabase/config.toml`, `e2e/run_e2e.ts`, `TEST_READY.md`)
**Profile**: General Project
**Verdict**: FIX STRATEGY FORMULATED (Addresses Realtime Contract Violation, Daemon Corruption, Process Elimination Wars, and Masked Failures)

## 1. Observation
- **Realtime Contract Violation (`supabase/config.toml`)**:
  - `SCOPE.md` explicitly requires `[realtime] enabled = true`.
  - Directly inspected `supabase/config.toml` (lines 81-84) and observed:
    ```toml
    [realtime]
    enabled = false
    # Force IPv4 resolution to prevent Elixir runtime nxdomain errors
    ip_version = "IPv4"
    ```
- **Unresolved `supabase-go` Daemon Corruption (`e2e/run_e2e.ts`)**:
  - Directly inspected `e2e/run_e2e.ts` (lines 14-24) and observed `teardownSupabase()` executes `pkill -9 -f "supabase-go"` BEFORE `docker rm -f`:
    ```typescript
    function teardownSupabase() {
      console.log('Performing bulletproof Supabase teardown and cleanup...');
      // Targeted pkill for Supabase CLI/daemon processes BEFORE docker cleanup
      try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      // Docker container and volume cleanup (targeted)
      try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('rm -rf supabase/.temp /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
      try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
    }
    ```
  - Observed Challenger 9's empirical findings that `npx supabase start` and `npx supabase db reset` fail with `Unknown: ChildProcess.exitCode (.../bin/supabase-go --output json --debug start)` and collide with `supabase start is already running.` / `supabase_db_expense-dashboard container is not ready: starting`.

- **Concurrent Process Elimination War (`e2e/run_e2e.ts`)**:
  - Directly inspected `e2e/run_e2e.ts` (lines 239-273 and 280-303) and observed global `pgrep -f "node.*run_e2e"` and `pgrep -f "node|tsx|jest|webpack"` followed by `kill -9`.
  - Observed Challenger 10's empirical findings that in a shared environment with concurrent terminal sessions (`pts/3`, `pts/4`, `pts/5`, `task-20`), this global cleanup creates an adversarial "process elimination war" where concurrent test runners identify and abruptly kill each other with `kill -9`.

- **Masked Failure Vulnerability (`TEST_READY.md` & `e2e/run_e2e.ts`)**:
  - Directly inspected `TEST_READY.md` (line 4) and observed the test invocation string uses `exec npx tsx e2e/run_e2e.ts`:
    ```markdown
    - Command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts`
    ```
  - Observed Challenger 9 & 10's findings that `exec npx tsx e2e/run_e2e.ts` replaces the shell process with `npx`, making `npx` the direct parent of `tsx e2e/run_e2e.ts`. When `tsx e2e/run_e2e.ts` is killed via `kill -9` or aborts during `teardownSupabase()`, `npx` absorbs the SIGKILL/SIGTERM without propagating the error and exits with code 0 (`The command completed successfully.`), falsely reporting a successful test pass while skipping Next.js build and Playwright tests.

## 2. Logic Chain
1. **Realtime Contract Violation**: `supabase/config.toml` explicitly sets `[realtime] enabled = false`. This disables the Realtime engine, violating `SCOPE.md` and causing Supabase Realtime health checks (`http://127.0.0.1:54321/realtime/v1/health`) to fail or timeout.
2. **`supabase-go` Daemon Corruption**: `teardownSupabase()` in `e2e/run_e2e.ts` executes `pkill -9 -f "supabase-go"` before `docker rm -f`. Abruptly killing the daemon while Supabase Docker containers are still actively running corrupts the daemon state and leaves orphaned lockfiles in `supabase/.temp` and `/tmp/supabase*`. When `npx supabase start` or `db reset` is subsequently called, the wrapper spawns `supabase-go`, which detects the corrupted state/lockfiles and fails with `Unknown: ChildProcess.exitCode`.
3. **Concurrent Process Elimination War**: `e2e/run_e2e.ts` uses global `pgrep` and `kill -9` to terminate lingering `run_e2e`, `node`, `tsx`, `jest`, and `webpack` processes across all TTYs. In a multi-tenant environment where multiple agents or tasks (`pts/3`, `pts/4`, `task-20`) run concurrently, a newly started `run_e2e.ts` will detect and kill the `run_e2e.ts` of another task that is mid-execution (e.g., waiting during `init_db.ts`).
4. **Masked Failure Vulnerability**: `TEST_READY.md` invokes `exec npx tsx e2e/run_e2e.ts`. `exec` replaces the shell with `npx`. When `tsx e2e/run_e2e.ts` is killed by another agent's `kill -9` or terminates during `teardownSupabase()`, `npx` sees its child die with SIGKILL but exits with code 0. Consequently, the test runner terminates abruptly, skipping the Next.js build and Playwright tests, but the background task runner sees exit code 0 and falsely reports `The command completed successfully.`

## 3. Caveats
- No caveats. All findings are fully supported by direct file inspection and the empirical evidence from Verification Swarm Iteration 5 (Challengers 9 & 10, Forensic Auditor 5, Reviewers 9 & 10).

## 4. Conclusion
To achieve a robust, multi-tenant aware Tier 3 E2E test pass (Milestone 5.3) that is immune to daemon corruption, process elimination wars, and masked failures, the following concrete fix strategy must be implemented by the designated Worker agent:

### Concrete Fix Strategy

#### 1. `supabase/config.toml` (Enable Realtime)
- **Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/supabase/config.toml`
- **Location**: Line 82 (under `[realtime]`)
- **Change**: Modify `enabled = false` to `enabled = true`.
```toml
[realtime]
enabled = true
# Force IPv4 resolution to prevent Elixir runtime nxdomain errors
ip_version = "IPv4"
```

#### 2. `TEST_READY.md` (Prevent Swallowed Exit Codes)
- **Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- **Location**: Line 4
- **Change**: Replace `exec npx tsx e2e/run_e2e.ts` with `node node_modules/.bin/tsx e2e/run_e2e.ts`.
```markdown
- Command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts`
```

#### 3. `e2e/run_e2e.ts` (Bulletproof Teardown, Mutex Locking & TTY-Scoped Cleanup)
- **Target File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts`
- **Changes**:

##### A. Bulletproof `teardownSupabase()` (Lines 14-24)
Ensure `docker rm -f`, `docker volume rm -f`, and `docker network rm` execute BEFORE `pkill -9 -f "supabase-go"`, followed by a `while docker ps -aq` wait loop and `sleep 20`:
```typescript
function teardownSupabase() {
  console.log('Performing bulletproof Supabase teardown and cleanup...');
  try { execSync('npx --no-install supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  // Docker container, volume, and network cleanup BEFORE pkill to prevent daemon corruption
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network ls -q --filter name=supabase | xargs -r docker network rm 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  // Targeted pkill ONLY AFTER containers are fully removed
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -a -q --filter name=supabase | grep -q .; do sleep 1; done', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
}
```

##### B. File-Based Mutex Locking (`/tmp/run_e2e.lock`) & TTY-Scoped Cleanup Helper
Add the following helper functions at the top of `e2e/run_e2e.ts` (e.g., after line 13):
```typescript
const lockfile = '/tmp/run_e2e.lock';

function acquireLock() {
  console.log('Acquiring file-based mutex lock (/tmp/run_e2e.lock)...');
  let attempts = 60;
  while (attempts > 0) {
    try {
      fs.writeFileSync(lockfile, process.pid.toString(), { flag: 'wx' });
      console.log('Mutex lock acquired successfully.');
      return;
    } catch (e) {
      console.log(`Another run_e2e instance is active. Waiting for lock... (${attempts} attempts left)`);
      try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}
      attempts--;
    }
  }
  throw new Error('Failed to acquire mutex lock /tmp/run_e2e.lock after 5 minutes. Aborting to prevent process collision.');
}

function releaseLock() {
  try {
    if (fs.existsSync(lockfile)) {
      const lockPid = fs.readFileSync(lockfile, 'utf8').trim();
      if (lockPid === process.pid.toString()) {
        fs.unlinkSync(lockfile);
        console.log('Mutex lock released.');
      }
    }
  } catch (e) {}
}

function killLingeringProcessesScoped(pattern: string) {
  try {
    const myTty = execSync(`ps -p ${process.pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
    if (!myTty || myTty === '?' || myTty === '') {
      console.log(`Running without a TTY (${myTty}). Skipping global pkill to avoid process elimination war.`);
      return;
    }
    const pids = execSync(`pgrep -f "${pattern}" 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
    const pidsToKill = pids.filter(pid => {
      if (pid === process.pid || pid === process.ppid) return false;
      try {
        const pTty = execSync(`ps -p ${pid} -o tty= 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
        return pTty === myTty;
      } catch (e) {
        return false;
      }
    });
    if (pidsToKill.length > 0) {
      console.log(`Killing lingering processes (${pattern}) scoped to TTY ${myTty}: ${pidsToKill.join(' ')}`);
      execSync(`kill -9 ${pidsToKill.join(' ')} 2>/dev/null || true`, { stdio: 'inherit' });
    }
  } catch (e) {}
}
```

##### C. Integrate Mutex Lock & Replace Global `pgrep/kill` in `setup()`, `cleanup()`, and `run()`
- In `setup()` (line 26), add `acquireLock();` at the very beginning.
- In `cleanup()` (line 49), add `releaseLock();` at the end.
- In `run()` (lines 239-273), replace the entire complex `ancestorPids` / global `pgrep -f "node.*run_e2e"` block before `npm run build` with:
```typescript
    console.log('Building fresh Next.js production bundle...');
    killLingeringProcessesScoped('node.*run_e2e|tsx.*run_e2e');
```
- In `run()` (lines 280-303), replace the post-build global `pgrep -f "node|tsx|jest|webpack"` block with:
```typescript
    killLingeringProcessesScoped('node|tsx|jest|webpack');
```

## 5. Verification Method
To independently verify the success of the fix strategy once implemented by the Worker:

1. **Verify `supabase/config.toml`**:
   ```bash
   grep -A 3 "\[realtime\]" supabase/config.toml
   ```
   **Expected Result**: `enabled = true`.

2. **Verify `TEST_READY.md`**:
   ```bash
   grep "node node_modules/.bin/tsx e2e/run_e2e.ts" TEST_READY.md
   ```
   **Expected Result**: Matches the updated command string without `exec npx tsx`.

3. **Verify `e2e/run_e2e.ts` Teardown & Scoped Cleanup**:
   ```bash
   grep -E "acquireLock|killLingeringProcessesScoped|docker ps -a -q --filter name=supabase" e2e/run_e2e.ts
   ```
   **Expected Result**: Confirms the presence of mutex locking, TTY-scoped cleanup, and `docker rm -f` executing before `pkill`.

4. **Execute Master E2E Test Runner**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
   **Expected Result**: All tests pass with exit code 0. If executed concurrently in another terminal, the second instance will cleanly wait for `/tmp/run_e2e.lock` without killing the first instance.
