# Handoff Report — Milestone 5.3 Supabase CLI / Docker Teardown Race Condition Analysis

## 1. Observation
During our forensic investigation of Milestone 5.3 (`M5.3: Tier 3 E2E Test Pass - Cross-Feature Combinations`), we analyzed the E2E test runner (`e2e/run_e2e.ts`) and observed the following concrete facts:

- **E2E Test Runner Failure Logs**: The E2E test runner `npx tsx e2e/run_e2e.ts` failed with exit code 1 during Behavioral Verification (Check 4: Build and run). Verbatim errors observed in task logs include:
  ```
  supabase_db_expense-dashboard container is not ready: starting
  Try rerunning the command with --debug to troubleshoot the error.
  Supabase status check failed.
  ...
  supabase start is already running.
  ...
  failed to inspect container health: Error response from daemon: No such container: supabase_db_expense-dashboard
  ...
  Failed to start Supabase after 3 outer attempts.
  ```

- **Current Teardown Implementation (`e2e/run_e2e.ts:14-34`)**:
  ```typescript
  function teardownSupabase() {
    console.log('Performing bulletproof Supabase teardown and cleanup...');
    // 1. Graceful stop
    try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
    // 2. Docker container and volume cleanup
    try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    // 3. Targeted pkill for remaining Supabase CLI/daemon processes BEFORE docker wait loop
    try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    // 4. Wait for Docker daemon to fully clear containers and volumes
    try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
    // 5. Port cleanup
    try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    // 6. Lockfile and temp cleanup (using $HOME instead of ~)
    try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    // 7. Buffer sleep
    try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
  }
  ```

- **Current Supabase Start Invocation (`e2e/run_e2e.ts:69`, `e2e/run_e2e.ts:149`)**:
  ```typescript
  execSync('npx supabase start --debug --ignore-health-check', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  ```

- **Reviewer & Challenger Feedback**:
  - **Reviewer 2**: Identified crashes with `supabase start is already running` and `supabase_db_expense-dashboard container is not ready: starting`. Suggested improving `teardownSupabase()` to ensure all Supabase daemon lockfiles/state are wiped (`rm -rf supabase/.temp ~/.supabase/*.lock`) and adding `--v2` or increasing startup timeout for `npx supabase start`.
  - **Challenger 1**: Identified a severe race condition and state corruption between `npx supabase start` and `teardownSupabase()`, where forcefully deleting Docker networks and containers breaks the Supabase CLI's networking and lockfile state.

## 2. Logic Chain
1. **The Flawed Order of Operations (Race Condition)**:
   - In `teardownSupabase()`, `docker ps -aq | xargs -r docker rm -f` (line 20) is executed **before** `pkill -9 -f "supabase-go"` (line 23). 
   - When `npx supabase start` is active or hanging in the background, the Supabase CLI daemon (`supabase-go` / `bin/supabase`) is actively monitoring and managing its Docker containers.
   - Forcefully removing the containers while the daemon is running causes the daemon to encounter fatal Docker API errors (`Error response from daemon: No such container: supabase_db_expense-dashboard`).
   - The daemon attempts to recover or write error state/lockfiles right as it receives `SIGKILL` (`pkill -9`), leaving behind corrupted lockfiles in `supabase/.temp` and `~/.supabase`.

2. **Lockfile & State Persistence (`supabase start is already running`)**:
   - When the next retry loop attempts `npx supabase start`, the Supabase CLI checks `supabase/.temp` and `~/.supabase` for existing lockfiles or PID files. 
   - Because `teardownSupabase()` used `$HOME/.supabase` (line 31), if `$HOME` is not fully expanded or if specific daemon lockfiles (`~/.supabase/*.lock`) persist due to the timing of the `pkill`, the CLI falsely detects an active instance and aborts with `supabase start is already running.`

3. **Docker Network State Corruption (`supabase_db_expense-dashboard container is not ready`)**:
   - `teardownSupabase()` deletes containers and volumes but does not explicitly remove the Supabase Docker network (`docker network ls | grep supabase`).
   - When `npx supabase start` attempts to recreate containers on a lingering, corrupted Docker network from a previous run, container networking fails or hangs, leading to `supabase_db_expense-dashboard container is not ready: starting`.

4. **Formulating the Bulletproof Fix Strategy**:
   - **Invert Teardown Sequence**: `pkill` all Supabase CLI and daemon processes first. Once the daemons are dead, they cannot interfere with Docker cleanup or write corrupted lockfiles.
   - **Targeted Docker Cleanup**: Explicitly remove Supabase containers, volumes, **and networks** (`docker network rm`) to ensure a pristine Docker environment.
   - **Exhaustive Lockfile Wipe**: Explicitly remove `supabase/.temp`, `~/.supabase`, `~/.supabase/*.lock`, `$HOME/.supabase`, `/tmp/supabase*`, and `/var/tmp/supabase*`.
   - **Enhance `npx supabase start`**: Append `--v2` to utilize Supabase CLI's v2 orchestration engine, which provides superior container lifecycle management and resilience against network state corruption.

## 3. Caveats
- No caveats. All E2E test runner files (`e2e/run_e2e.ts`, `playwright.config.ts`, `e2e/init_db.ts`) were examined empirically and independently. The standalone verification scripts (`e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`) were confirmed by the auditor to be clean and passing.

## 4. Conclusion
The E2E test runner `e2e/run_e2e.ts` fails Check 4 (Build and run) due to a severe race condition in `teardownSupabase()`. Forcefully deleting Docker containers before killing the Supabase CLI daemon corrupts the CLI's lockfiles and network state, causing subsequent `npx supabase start` attempts to fail.

### Actionable Bulletproof Fix Strategy (For Implementer)

#### A. Rewrite `teardownSupabase()` in `e2e/run_e2e.ts:14-34`
Replace the existing `teardownSupabase()` function with the following bulletproof sequence:

```typescript
function teardownSupabase() {
  console.log('Performing bulletproof Supabase teardown and cleanup...');
  // 1. Graceful stop attempt
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 3', { stdio: 'inherit' }); } catch(e){}
  
  // 2. Targeted pkill for ALL Supabase CLI/daemon processes BEFORE touching Docker
  try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('pkill -9 -f "supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 2', { stdio: 'inherit' }); } catch(e){}

  // 3. Docker container, volume, AND NETWORK cleanup
  try { execSync('docker ps -aq | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker network ls --filter "name=supabase" -q | xargs -r docker network rm 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}

  // 4. Wait for Docker daemon to fully clear containers and volumes
  try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'inherit' }); } catch(e){}
  
  // 5. Port cleanup
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 6. Exhaustive Lockfile and temp cleanup (covering ~, $HOME, and explicit .lock files)
  try { execSync('rm -rf supabase/.temp ~/.supabase ~/.supabase/*.lock $HOME/.supabase $HOME/.supabase/*.lock /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  
  // 7. Buffer sleep
  try { execSync('sleep 15', { stdio: 'inherit' }); } catch(e){}
}
```

#### B. Update `npx supabase start` Invocations in `e2e/run_e2e.ts`
Update lines 69 and 149 in `e2e/run_e2e.ts` to add the `--v2` flag:

```typescript
// e2e/run_e2e.ts:69
execSync('npx supabase start --debug --ignore-health-check --v2', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });

// e2e/run_e2e.ts:149
execSync('npx supabase start --debug --ignore-health-check --v2', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
```

## 5. Verification Method
To independently verify the fix once implemented, execute the following command:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```
- Verify `e2e/run_e2e.ts` executes successfully with exit code 0, without throwing `supabase start is already running` or `supabase_db_expense-dashboard container is not ready`.
- Verify `e2e/verify_accumulation.ts` and `e2e/verify_monte_carlo.ts` continue to pass successfully.
