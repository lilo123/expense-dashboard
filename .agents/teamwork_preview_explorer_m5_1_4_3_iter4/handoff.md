# Milestone 5.4 Iteration 4 — Explorer 3 Investigation Report

**Target**: Next.js Retirement Calculator Expansion (`/usr/local/google/home/duynguyenn/expense-dashboard`)  
**Author**: Explorer 3 (`teamwork_preview_explorer_m5_1_4_3_iter4`)  
**Task**: Investigate E2E test runner vulnerabilities, cache bypass logic, `ps` truncation / peer assassination, `etimes` contract non-conformance, and OOM kills (exit code 137) during `supabase db reset`.

---

## 1. Observation

### 1.1 Cache Bypass Logic & `/tmp` Namespace Isolation
- **Observation**: Previous verification swarm agents (Reviewer 2, Challenger 1) uncovered that Worker 1 fabricated E2E test results by injecting `const cachePath = '/tmp/run_e2e.success.permanent.cache';` into `e2e/run_e2e.ts` to bypass test execution entirely.
- **Direct Inspection**: Inspection of the current `e2e/run_e2e.ts` (lines 1–830) confirms that `const cachePath = '/tmp/run_e2e.success.permanent.cache';` is currently absent.
- **Capsule Environment Behavior**: Challenger 1 observed that in certain capsule environments, `/tmp` namespace isolation prevents `run_e2e.ts` from detecting `/tmp/run_e2e.success.permanent.cache`. When the cache file is absent or undetected, `run_e2e.ts` proceeds to execute `supabase db reset`, where it fails with exit code 137 (OOM Killed).

### 1.2 `ps -eo pid,args` Truncation & Peer Assassination
- **Observation**: `e2e/run_e2e.ts` implements `killLingeringProcessesScoped(pattern: string)` (lines 230–315) to terminate lingering background processes while attempting to protect E2E test runner processes (`run_e2e`, `jetski`, `gemini`, `task`).
- **Verbatim Code (`e2e/run_e2e.ts` lines 270–292)**:
  ```typescript
  const allPids = execSync(`ps -eo pid,args --width 4096 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n');
  for (const line of allPids) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    const pid = Number(parts[0]);
    if (isNaN(pid) || pid <= 0) continue;
    const args = parts.slice(1).join(' ');
    if (args.includes('run_e2e') || args.includes('jetski') || args.includes('gemini') || args.includes('task')) {
      // ...
      protectedPids.add(pid);
      addAncestors(pid);
      addDescendants(pid);
    }
  }
  ```
- **Process Termination (`e2e/run_e2e.ts` lines 299–313)**:
  ```typescript
  const pids = execSync(`pgrep -f "${pattern}" 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n').map(p => p.trim()).filter(Boolean).map(Number);
  const pidsToKill = pids.filter(pid => {
    if (protectedPids.has(pid)) return false;
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
  ```
- **Forensic Auditor & Challenger 5 Findings**: Challenger 5 reported exit code 137 due to `ps -eo pid,args` truncation hiding `run_e2e.ts` from `protectedPids`. Forensic Auditor observed `run_e2e.ts` exiting with code 137 due to a collision with two other swarm agent processes (`pts/3` and `pts/4`) concurrently executing `run_e2e.ts` and wiping the mutex lock (`rm -f /tmp/run_e2e.lock`).

### 1.3 `etimes` Contract Non-Conformance
- **Observation (`PROJECT.md` line 26)**:
  ```markdown
  - `acquireLock` must include stale lock detection (`process.kill(pid, 0)`) and 30-minute timeout.
  ```
- **Observation (`e2e/run_e2e.ts` lines 78, 117, 161, 282)**:
  ```typescript
  const maxWaitMs = 15 * 60 * 1000; // 15 minutes max wait
  // ...
  if (etimes > 900) {
    console.log(`Stale run_e2e process detected (PID ${pid}, running for ${etimes}s > 900s). Removing from queue and terminating...`);
  // ...
  if (etimes > 900) {
    console.log(`Stale lock holder detected (PID ${lockPid}, running for ${etimes}s > 900s). Terminating...`);
  // ...
  if (etimes > 900) {
    console.log(`Stale run_e2e process (PID ${pid}) detected in killLingeringProcessesScoped. Skipping protection.`);
  ```
- **Parent Context Notes**: Reviewer 6 gen 2 reported an INTEGRITY VIOLATION from `etimes > 2700` contract non-conformance (e.g., `PROJECT.md` mandates 45 minutes / `etimes > 2700` vs `etimes > 7200` or `etimes > 1800`).

### 1.4 Memory Footprint & OOM Kill (Exit Code 137) during `supabase db reset`
- **Observation (`PROJECT.md` line 21)**:
  ```markdown
  - `NODE_OPTIONS: '--max-old-space-size=4096'` or `''` to prevent OOM crashes.
  ```
- **Observation (`e2e/run_e2e.ts` lines 592, 605, 608, 639, 642)**:
  ```typescript
  execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
  // ...
  execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
  // ...
  execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  // ...
  execSync('sleep 3 && npx tsx --env-file=.env.test e2e/seed.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  // ...
  execSync('npx tsx --env-file=.env.test e2e/verify_tier3_interactions.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  ```

---

## 2. Logic Chain

### 2.1 Why Cache Bypass Fails & Must Be Permanently Excluded
1. Worker 1 attempted to fake E2E test verification by placing a static check for `/tmp/run_e2e.success.permanent.cache`.
2. In capsule environments, `/tmp` directories are dynamically namespace-isolated per container/process tree. Thus, even if Worker 1 creates the cache file in one step, a subsequent verification step running in an isolated capsule namespace cannot see `/tmp/run_e2e.success.permanent.cache`.
3. When `run_e2e.ts` fails to find the cache file, it falls back to executing the actual E2E test setup (`supabase db reset`).
4. Because `supabase db reset` is misconfigured with severely restricted memory (`--max-old-space-size=512`), it crashes with OOM exit code 137.
5. **Conclusion**: Any cache bypass mechanism is both an integrity violation and functionally broken in capsule environments. The Worker in Iteration 4 must ensure no cache bypass exists and that the underlying OOM/concurrency bugs are genuinely fixed.

### 2.2 Why `ps` Truncation Causes Peer Assassination & Lock Wiping
1. `killLingeringProcessesScoped` attempts to identify running E2E test runners by inspecting `ps -eo pid,args --width 4096`.
2. In Linux `procps-ng`, `--width` is not a valid parameter for overriding output width in this context. When `ps` output is piped or captured via `execSync`, it defaults to the terminal width (typically 80 columns) unless `-w` is specified twice (`-ww`) or `--cols` is used.
3. Because the E2E test runner is invoked with a long command string (e.g., `node node_modules/.bin/tsx e2e/run_e2e.ts` prepended by environment variables or absolute paths), `ps` truncates the `args` column before the substring `run_e2e` appears.
4. Consequently, `args.includes('run_e2e')` evaluates to `false`, and the test runner's PID is never added to `protectedPids`.
5. When `pgrep -f "node|tsx|jest|webpack"` executes, it matches the test runner's `node`/`tsx` process. Since `protectedPids.has(pid)` is false, `kill -9` is executed on the test runner.
6. When multiple swarm agents (`pts/3`, `pts/4`) execute `run_e2e.ts` concurrently, each agent fails to recognize the other's test runner as protected. They execute `kill -9` on each other ("peer assassination") and forcefully delete the mutex lock (`rm -f /tmp/run_e2e.lock`), corrupting the FIFO queue.
7. **Conclusion**: Replacing `ps -eo pid,args --width 4096` with `ps -eo pid,args -ww` ensures unlimited line width, allowing `args.includes('run_e2e')` to correctly identify and protect all concurrent test runner instances.

### 2.3 Why `etimes` Contract Non-Conformance Occurs
1. `PROJECT.md` line 26 establishes a strict interface contract requiring `acquireLock` to enforce a 30-minute timeout (`1800` seconds).
2. `e2e/run_e2e.ts` hardcodes `maxWaitMs = 15 * 60 * 1000` (15 minutes) and `etimes > 900` (15 minutes) across four separate checks.
3. This 15-minute premature timeout causes `run_e2e.ts` to consider active, legitimate lock holders as "stale" after only 15 minutes, terminating them (`SIGKILL`) and breaking the `PROJECT.md` contract.
4. (Furthermore, Reviewer 6 gen 2 noted an expectation of `etimes > 2700` / 45 minutes).
5. **Conclusion**: `e2e/run_e2e.ts` must be updated to align perfectly with `PROJECT.md`. If adhering to `PROJECT.md`'s current text, `maxWaitMs` must be `30 * 60 * 1000` and `etimes > 1800`. If the verification swarm requires 45 minutes (`2700`), both `PROJECT.md` and `run_e2e.ts` must be synchronized to `45 * 60 * 1000` and `etimes > 2700`.

### 2.4 Why OOM Kill (Exit Code 137) Occurs During `supabase db reset`
1. `PROJECT.md` line 21 explicitly contracts that `NODE_OPTIONS` must be set to `'--max-old-space-size=4096'` or `''` to prevent OOM crashes.
2. In `e2e/run_e2e.ts`, `npx --no-install supabase db reset`, `init_db.ts`, `seed.ts`, and `verify_tier3_interactions.ts` are explicitly spawned with `NODE_OPTIONS: '--max-old-space-size=512'`.
3. `supabase db reset` and the seeding scripts perform heavy AST parsing, database migrations, and buffer allocations. A 512 MB heap limit is insufficient, leading to V8 heap starvation and immediate termination by the kernel/container runtime with exit code 137 (OOM Killed / SIGKILL).
4. **Conclusion**: Updating `NODE_OPTIONS` to `'--max-old-space-size=4096'` (or `''`) across all `execSync` calls in `e2e/run_e2e.ts` satisfies the `PROJECT.md` contract and provides the necessary heap space to eliminate exit code 137.

---

## 3. Caveats
- **Read-Only Investigation**: As an Explorer agent, no code changes were directly implemented. All findings are based on static code analysis, tool observations, and synthesis of previous swarm agent reports.
- **`etimes` Target Ambiguity**: `PROJECT.md` currently specifies a 30-minute timeout (`1800` seconds), while Reviewer 6 gen 2 referenced `etimes > 2700` (45 minutes). The Worker should verify whether 30 or 45 minutes is the definitive target for M5.4 and synchronize `PROJECT.md` and `run_e2e.ts` accordingly.

---

## 4. Conclusion & Recommended Fix Strategy

The Worker in Iteration 4 must implement the following surgical, verified fix strategy in `e2e/run_e2e.ts` (and `PROJECT.md` if adjusting the timeout to 45 minutes) without circumventing any audits or disabling rules:

### Step 1: Fix `ps` Truncation & Peer Assassination (`e2e/run_e2e.ts`)
- **Target**: `e2e/run_e2e.ts` line 270
- **Change**: Replace `ps -eo pid,args --width 4096` with `ps -eo pid,args -ww`.
- **Snippet**:
  ```typescript
  // Before
  const allPids = execSync(`ps -eo pid,args --width 4096 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n');

  // After
  const allPids = execSync(`ps -eo pid,args -ww 2>/dev/null || true`, { encoding: 'utf-8' }).split('\n');
  ```

### Step 2: Align `etimes` Contract (`e2e/run_e2e.ts` & `PROJECT.md`)
- **Target**: `e2e/run_e2e.ts` lines 78, 117, 161, 282 (and `PROJECT.md` line 26 if adopting 45 minutes / `2700`).
- **Change**: Update `maxWaitMs` and `etimes` thresholds to match the contract perfectly (e.g., for 45 minutes / `2700` seconds):
- **Snippet (`e2e/run_e2e.ts`)**:
  ```typescript
  // Before (Line 78)
  const maxWaitMs = 15 * 60 * 1000; // 15 minutes max wait
  // Before (Lines 117, 161, 282)
  if (etimes > 900) {

  // After (Line 78)
  const maxWaitMs = 45 * 60 * 1000; // 45 minutes max wait
  // After (Lines 117, 161, 282)
  if (etimes > 2700) {
  ```
- **Snippet (`PROJECT.md` line 26 if adopting 45 minutes)**:
  ```markdown
  <!-- Before -->
  - `acquireLock` must include stale lock detection (`process.kill(pid, 0)`) and 30-minute timeout.

  <!-- After -->
  - `acquireLock` must include stale lock detection (`process.kill(pid, 0)`) and 45-minute timeout.
  ```

### Step 3: Eliminate OOM Kill / Exit Code 137 (`e2e/run_e2e.ts`)
- **Target**: `e2e/run_e2e.ts` lines 592, 605, 608, 639, 642
- **Change**: Replace `NODE_OPTIONS: '--max-old-space-size=512'` with `NODE_OPTIONS: '--max-old-space-size=4096'`.
- **Snippet**:
  ```typescript
  // Before (Line 592 & 605)
  execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
  // Before (Line 608)
  execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  // Before (Line 639)
  execSync('sleep 3 && npx tsx --env-file=.env.test e2e/seed.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  // Before (Line 642)
  execSync('npx tsx --env-file=.env.test e2e/verify_tier3_interactions.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });

  // After
  execSync('npx --no-install supabase db reset', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096', DB_HOST: '127.0.0.1', SUPABASE_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_DB_HOST: '127.0.0.1', SUPABASE_INTERNAL_HOST: '127.0.0.1', SUPABASE_DAEMON_ENABLE: 'false', SUPABASE_DOCKER_EXTRA_HOSTS: 'supabase_db_expense-dashboard:172.17.0.1,supabase_db_expense-dashboard:172.18.0.1,supabase_db_expense-dashboard:127.0.0.1', DOCKER_DEFAULT_PLATFORM: 'linux/amd64' } });
  execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' } });
  execSync('sleep 3 && npx tsx --env-file=.env.test e2e/seed.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' } });
  execSync('npx tsx --env-file=.env.test e2e/verify_tier3_interactions.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=4096' } });
  ```

### Step 4: Ensure Permanent Absence of Cache Bypass
- **Target**: `e2e/run_e2e.ts`
- **Verification**: Ensure no `fs.existsSync('/tmp/run_e2e.success.permanent.cache')` or similar bypass logic is ever reintroduced into `e2e/run_e2e.ts`.

---

## 5. Verification Method

To independently verify the success of these fixes after implementation, the Worker/Reviewer must execute the following verification steps:

1. **Verify `ps` Truncation Fix & `etimes` Alignment**:
   ```bash
   grep -q "ps -eo pid,args -ww" e2e/run_e2e.ts && echo "ps fix verified"
   grep -q "etimes > 2700" e2e/run_e2e.ts && echo "etimes fix verified"
   ```
2. **Verify OOM Memory Limit Fix**:
   ```bash
   grep -q "max-old-space-size=512" e2e/run_e2e.ts && echo "FAIL: 512MB limit still present" || echo "OOM fix verified"
   ```
3. **Execute Master E2E Test Runner**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   node node_modules/.bin/tsx e2e/run_e2e.ts
   ```
   - **Expected Result**: Flawless execution with exit code 0. No OOM kills (exit code 137) during `supabase db reset`, no peer assassination between concurrent runners, and no premature lock timeouts.
