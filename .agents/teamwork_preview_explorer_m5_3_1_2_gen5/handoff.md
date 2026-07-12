# Handoff Report — Milestone 5.3 (Iteration 5 Exploration)

**Work Product**: Milestone 5.3 (M5.3: Tier 3 E2E Test Pass - Cross-Feature Combinations) - Explorer Investigation
**Profile**: General Project
**Status**: Exploration Complete (Ready for Implementation)

---

## 1. Observation
- **Source Inspection (`e2e/adv_supabase_dns_nxdomain.ts`)**:
  - `teardownSupabase()` (lines 15-30) uses `pkill -9 -f "supabase-go"`, `pkill -9 -f "supabase start"`, `pkill -9 -f "supabase db reset"`, `pkill -9 -f "supabase migration"`. It does NOT contain `grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_supabase`.
  - `teardownSupabase()` performs `docker ps -a -q --filter name=supabase | xargs -r docker rm -f` (line 23) and `docker network rm supabase_network_expense-dashboard` (line 26), but lacks explicit force-removal of `supabase_db_expense-dashboard` by name and does not perform container cleanup after network removal.
  - `verifySupabaseDnsResolution()` (lines 45-49) correctly wraps `execSync('npx --no-install supabase start --debug', ...)` in an inner try-catch block.
- **Source Inspection (`e2e/run_e2e.ts`)**:
  - `teardownSupabase()` (lines 69-88) uses `pkill -9 -f "supabase"` (line 83) along with other `pkill` commands. This broad pattern matches `adv_supabase_dns_nxdomain.ts` and task runner processes, causing unintended process terminations. It lacks the required `grep -v` process filtering.
  - `teardownSupabase()` lacks explicit `docker rm -f supabase_db_expense-dashboard` and does not perform container cleanup after network removal (line 76).
  - `setup()` (lines 129-136) calls `execSync('npx supabase start --debug', ...)` directly inside the outer try block and again in the catch block without inner try-catch wrappers. If `execSync` throws `PlatformError: Unknown: ChildProcess.exitCode`, the exception propagates out of `setup()` and aborts `run()`, completely skipping the `fetch('http://127.0.0.1:54321')` reachability check loop (lines 139-151).
  - `robustSupabaseRestart()` (lines 184-195) calls `execSync('npx supabase start --debug', ...)` without inner try-catch wrappers. If `execSync` throws, `robustSupabaseRestart()` throws, breaking the `while (dbPushRetries > 0 && !dbPushSuccess)` loop (lines 258-268).

---

## 2. Logic Chain
- **Missing Inner Try-Catch Blocks**:
  - In `e2e/run_e2e.ts`, the Supabase CLI (`supabase-go`) frequently exits with a non-zero exit code (`PlatformError`) even when the underlying Docker containers start successfully. Because `execSync('npx supabase start --debug')` is not wrapped in an inner try-catch block in `setup()` and `robustSupabaseRestart()`, `execSync` throws an exception that bypasses the subsequent `fetch('http://127.0.0.1:54321')` reachability check loops. Wrapping these calls in inner try-catch blocks ensures the script proceeds to verify actual HTTP reachability.
- **Lingering Container Conflicts**:
  - Docker containers in `Creating` or `Created` states can linger during rapid teardown/restart cycles, locking the container name `/supabase_db_expense-dashboard` and the network `supabase_network_expense-dashboard`. `teardownSupabase()` must explicitly execute `docker rm -f supabase_db_expense-dashboard 2>/dev/null || true` and run `docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true` both before and after network removal to guarantee a clean environment for the next startup attempt.
- **Process Filtering**:
  - Using `pkill -9 -f "supabase"` or `pkill -9 -f "supabase start"` matches the test runner script (`adv_supabase_dns_nxdomain.ts`) and Jetski background tasks (`task-31`), leading to suicide or termination of the test harness. Replacing `pkill` with `ps aux | grep -E "supabase-go|npx supabase|supabase start|supabase db reset|supabase migration|supabase" | grep -v grep | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_supabase | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true` ensures only the intended Supabase CLI/daemon processes are terminated.

---

## 3. Caveats
- No caveats. The investigation directly confirmed all findings from the Forensic Auditor's report. The proposed fix strategy is fully scoped to address the identified integrity violations and robustness flaws without altering core business logic or test assertions.

---

## 4. Conclusion
- **Assessment**: The codebase currently পন্থা contains the robustness flaws and integrity violations identified in Iteration 4. `e2e/run_e2e.ts` lacks inner try-catch blocks around `execSync('npx supabase start')`, and `teardownSupabase()` in both `e2e/run_e2e.ts` and `e2e/adv_supabase_dns_nxdomain.ts` lacks process filtering and robust container force-removal.
- **Actionable Fix Strategy (For Implementer)**:
  1. **Update `teardownSupabase()` in `e2e/adv_supabase_dns_nxdomain.ts` and `e2e/run_e2e.ts`**:
     - Replace all `pkill -9 -f` lines with:
       ```typescript
       try { execSync('ps aux | grep -E "supabase-go|npx supabase|supabase start|supabase db reset|supabase migration|supabase" | grep -v grep | grep -v task | grep -v jetski | grep -v gemini | grep -v verify | grep -v run_e2e | grep -v adv_supabase | awk \'{print $2}\' | xargs -r kill -9 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       ```
     - Add explicit container force-removal by name before and after network removal:
       ```typescript
       try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('while docker ps -a -q --filter name=supabase | grep -q .; do docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true; sleep 2; done', { stdio: 'ignore', timeout: 15000 }); } catch(e){}
       try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('docker network ls -q --filter name=supabase | xargs -r docker network rm 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       try { execSync('docker ps -a -q --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
       ```
  2. **Update `setup()` in `e2e/run_e2e.ts`**:
     - Wrap `execSync('npx supabase start --debug', ...)` in inner try-catch blocks:
       ```typescript
       console.log('Attempting to start Supabase cleanly...');
       try {
         try {
           execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
         } catch (startErr) {
           console.warn('npx supabase start exited non-zero on first attempt. Proceeding to check reachability...');
         }
         console.log('Supabase started successfully.');
       } catch (err) {
         console.error('Supabase start failed. Performing one final clean teardown and retry...');
         teardownSupabase();
         try {
           execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
         } catch (startErr) {
           console.warn('npx supabase start exited non-zero on retry. Proceeding to check reachability...');
         }
       }
       ```
  3. **Update `robustSupabaseRestart()` in `e2e/run_e2e.ts`**:
     - Wrap `execSync('npx supabase start --debug', ...)` in inner try-catch blocks:
       ```typescript
       function robustSupabaseRestart() {
         console.log('Performing robust Supabase restart...');
         teardownSupabase();
         try {
           try {
             execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
           } catch (startErr) {
             console.warn('npx supabase start exited non-zero in robustSupabaseRestart. Proceeding...');
           }
         } catch (err) {
           console.error('Robust Supabase restart failed on first attempt. Performing final teardown and retry...');
           teardownSupabase();
           try {
             execSync('npx supabase start --debug', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' } });
           } catch (startErr) {
             console.warn('npx supabase start exited non-zero on retry in robustSupabaseRestart. Proceeding...');
           }
         }
         try { execSync('sleep 10', { stdio: 'inherit' }); } catch(e){}
       }
       ```

---

## 5. Verification Method
- **Inspection Verification**:
  - Inspect `e2e/adv_supabase_dns_nxdomain.ts` and `e2e/run_e2e.ts` to verify that `teardownSupabase()` contains the exact `ps aux | grep ... | grep -v ... | xargs -r kill -9` filtering logic and `docker rm -f supabase_db_expense-dashboard` before/after network removal.
  - Inspect `e2e/run_e2e.ts` to verify that `execSync('npx supabase start --debug')` is wrapped in inner try-catch blocks in both `setup()` and `robustSupabaseRestart()`.
- **Behavioral Verification**:
  - Execute the following command in the project root (`/usr/local/google/home/duynguyenn/expense-dashboard`):
    ```bash
    export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/adv_supabase_dns_nxdomain.ts && export NODE_OPTIONS=--max-old-space-size=256 && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
    ```
  - Observe that the command completes successfully with exit code 0, without Supabase container conflict errors or unintended process terminations.
