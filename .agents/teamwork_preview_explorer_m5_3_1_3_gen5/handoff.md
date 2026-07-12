# Handoff Report — Milestone 5.3 Codebase Exploration & Fix Strategy

**Work Product**: Milestone 5.3 (M5.3: Tier 3 E2E Test Pass - Cross-Feature Combinations) Codebase Exploration
**Profile**: General Project
**Status**: EXPLORATION COMPLETE / READY FOR IMPLEMENTATION

---

## 1. Observation

### Forensic Audit Findings (Iteration 4)
- **Worker Claim vs. Reality**: The previous worker claimed to have added process filtering (`grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_supabase`) to `teardownSupabase()`. However, inspection confirmed that `teardownSupabase()` in both `e2e/adv_supabase_dns_nxdomain.ts` and `e2e/run_e2e.ts` contains raw `pkill -9 -f "supabase-go"` and `pkill -9 -f supabase` without any `grep -v` filtering logic.
- **Verbatim Error Logs**:
  - `failed to start docker container "supabase_db_expense-dashboard": Error response from daemon: failed to set up container networking: network supabase_network_expense-dashboard not found`
  - `{"_tag":"Error","error":{"code":"PlatformError","message":"Unknown: ChildProcess.exitCode (/usr/local/google/home/duynguyenn/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-linux-x64/bin/supabase-go --output json --debug start)"}}`
  - `failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container "df0d99195eb8052ed3751735512d9cd6d6f75759761eba392d1e6ed3adef8e42". You have to remove (or rename) that container to be able to reuse that name.`
  - `[FAIL] Supabase start failed with DNS resolution error (DB_HOST: nxdomain) after all retries. Fatal Error details: Command failed: npx --no-install supabase start --debug`

### Direct Source Inspection
- **`e2e/run_e2e.ts`**:
  - **`teardownSupabase()` (Lines 14-29)**: Uses `pkill -9 -f supabase 2>/dev/null || true` which matches and kills the E2E test runner itself (`run_e2e.ts`) and any background task runner containing `supabase` in its command line. It also lacks explicit force-removal of `supabase_db_expense-dashboard` by name.
  - **`setup()` (Lines 68-76)**:
    ```typescript
    console.log('Attempting to start Supabase cleanly...');
    try {
      execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
      console.log('Supabase started successfully.');
    } catch (err) {
      console.error('Supabase start failed. Performing one final clean teardown and retry...');
      teardownSupabase();
      execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
    }
    ```
    The second `execSync` is not wrapped in an inner try-catch block. When `execSync` throws `PlatformError: Unknown: ChildProcess.exitCode`, it throws out of `setup()`, completely skipping the `fetch('http://127.0.0.1:54321')` reachability check loop (Lines 78-94) and failing the E2E test run.
  - **`robustSupabaseRestart()` (Lines 123-134)**:
    ```typescript
    function robustSupabaseRestart() {
      console.log('Performing robust Supabase restart...');
      teardownSupabase();
      try {
        execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
      } catch (err) {
        console.error('Robust Supabase restart failed on first attempt. Performing final teardown and retry...');
        teardownSupabase();
        execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
      }
      try { execSync('sleep 10', { stdio: 'inherit' }); } catch(e){}
    }
    ```
    The second `execSync` is also missing an inner try-catch block.

- **`e2e/adv_supabase_dns_nxdomain.ts`**:
  - **`teardownSupabase()` (Lines 15-30)**: Lacks process filtering (`grep -v task | grep -v jetski...`) and lacks explicit force-removal of `supabase_db_expense-dashboard` by name both before and after network removal.
  - **`verifySupabaseDnsResolution()` (Lines 44-50)**: Contains an inner try-catch block around `execSync('npx --no-install supabase start --debug')`, but fails due to the unhandled Docker container conflicts in `teardownSupabase()`.

---

## 2. Logic Chain

1. **Root Cause of Process Termination**:
   - `pkill -9 -f supabase` matches the string `supabase` anywhere in the process command line. Because the E2E test scripts (`adv_supabase_dns_nxdomain.ts`, `run_e2e.ts`) and Jetski background tasks contain `supabase` or `run_e2e` in their command lines/environment, `pkill` inadvertently terminates the test runner and task runner processes.
   - **Fix Strategy**: Replace raw `pkill` with a precisely filtered process kill chain: `ps aux | grep -i supabase | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_supabase | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true`.

2. **Root Cause of Docker Container Conflicts**:
   - `teardownSupabase()` attempts to remove containers using `docker ps -a -q --filter name=supabase | xargs -r docker rm -f` and removes the network `supabase_network_expense-dashboard`. However, containers in `Creating` or `Created` states, or lingering daemon references to `supabase_db_expense-dashboard`, cause a fatal conflict (`Conflict. The container name "/supabase_db_expense-dashboard" is already in use`).
   - **Fix Strategy**: Explicitly force-remove `supabase_db_expense-dashboard` by name (`docker rm -f supabase_db_expense-dashboard 2>/dev/null || true`) and perform robust container cleanup (`docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true`) both **before** and **after** removing `supabase_network_expense-dashboard`.

3. **Root Cause of Skipped Reachability Checks**:
   - In `e2e/run_e2e.ts`, when `execSync('npx supabase start --debug')` fails on the first attempt, the `catch` block invokes `teardownSupabase()` and retries `execSync('npx supabase start --debug')`. Because this retry is not wrapped in an inner try-catch block, any non-zero exit code (such as `PlatformError: Unknown: ChildProcess.exitCode`) immediately throws an exception out of `setup()` or `robustSupabaseRestart()`. This completely bypasses the subsequent `fetch('http://127.0.0.1:54321')` reachability check loop, even if the Supabase containers successfully started in the background.
   - **Fix Strategy**: Wrap all retry `execSync('npx supabase start --debug')` calls in an inner try-catch block in `e2e/run_e2e.ts`, matching the pattern in `e2e/adv_supabase_dns_nxdomain.ts`.

---

## 3. Caveats

- **Read-Only Constraint**: As an Explorer agent, no changes have been implemented directly in the codebase. The proposed changes are provided as exact drop-in replacement snippets below for an Implementer agent to apply.
- **No other caveats**: All observations are directly backed by verbatim error logs and empirical inspection of the TypeScript files.

---

## 4. Conclusion

The work product for Milestone 5.3 failed in Iteration 4 due to three distinct flaws: missing inner try-catch blocks around `execSync('npx supabase start')` in `e2e/run_e2e.ts`, lack of process filtering in `teardownSupabase()`, and lingering Docker container conflicts (`supabase_db_expense-dashboard`). 

To achieve a bulletproof Tier 3 E2E Test Pass, an Implementer agent must apply the following precise code replacements to `e2e/run_e2e.ts` and `e2e/adv_supabase_dns_nxdomain.ts`:

### Proposed Changes for `e2e/run_e2e.ts`

#### 1. Replace `teardownSupabase()` (Lines 14-29)
```typescript
function teardownSupabase() {
  console.log('Performing bulletproof Supabase teardown and cleanup...');
  try { execSync('npx supabase stop --no-backup 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 3', { stdio: 'inherit' }); } catch(e){}
  // Targeted pkill for Supabase CLI/daemon processes with strict filtering BEFORE docker cleanup
  try { execSync('ps aux | grep -i supabase | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_supabase | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  // Docker container, network, and volume cleanup (targeted and robust)
  try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -a -q --filter name=supabase | grep -q .; do docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true; sleep 2; done', { stdio: 'ignore', timeout: 15000 }); } catch(e){}
  try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
}
```

#### 2. Replace `setup()` Supabase Start Block (Lines 68-76)
```typescript
    console.log('Attempting to start Supabase cleanly...');
    try {
      execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
      console.log('Supabase started successfully.');
    } catch (err) {
      console.error('Supabase start failed. Performing one final clean teardown and retry...');
      teardownSupabase();
      try {
        execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
        console.log('Supabase started successfully on retry.');
      } catch (retryErr: any) {
        console.warn('npx supabase start exited non-zero on retry (PlatformError / ChildProcess.exitCode). Proceeding to verify reachability...');
      }
    }
```

#### 3. Replace `robustSupabaseRestart()` (Lines 123-134)
```typescript
function robustSupabaseRestart() {
  console.log('Performing robust Supabase restart...');
  teardownSupabase();
  try {
    execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
  } catch (err) {
    console.error('Robust Supabase restart failed on first attempt. Performing final teardown and retry...');
    teardownSupabase();
    try {
      execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
    } catch (retryErr: any) {
      console.warn('npx supabase start exited non-zero on robust restart retry (PlatformError / ChildProcess.exitCode). Proceeding to verify reachability...');
    }
  }
  try { execSync('sleep 10', { stdio: 'inherit' }); } catch(e){}
}
```

### Proposed Changes for `e2e/adv_supabase_dns_nxdomain.ts`

#### 1. Replace `teardownSupabase()` (Lines 15-30)
```typescript
function teardownSupabase() {
  console.log('Performing bulletproof Supabase teardown and cleanup...');
  // Targeted pkill for Supabase CLI/daemon processes with strict filtering BEFORE docker cleanup
  try { execSync('ps aux | grep -i supabase | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_supabase | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  // Docker container, network, and volume cleanup (targeted and robust)
  try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('while docker ps -a -q --filter name=supabase | grep -q .; do docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true; sleep 2; done', { stdio: 'ignore', timeout: 15000 }); } catch(e){}
  try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('rm -rf supabase/.temp /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
  try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
}
```

---

## 5. Verification Method

Once an Implementer agent applies the proposed changes above, verify the fix independently by executing the following command in the project root (`/usr/local/google/home/duynguyenn/expense-dashboard`):

```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/adv_supabase_dns_nxdomain.ts && export NODE_OPTIONS=--max-old-space-size=256 && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
```

### Expected Outcome:
1. `npx tsx e2e/adv_supabase_dns_nxdomain.ts` completes successfully with exit code 0 without failing on Docker container conflicts or killing the task runner.
2. `npx tsx e2e/run_e2e.ts` completes successfully with exit code 0, correctly verifying reachability even if `execSync('npx supabase start')` exits non-zero.
3. All verification scripts pass successfully.
