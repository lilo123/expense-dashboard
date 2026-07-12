# Handoff Report — Milestone 5.2 Explorer 3 (Iteration 9)

**Work Product**: Investigation and Fix Strategy for Supabase Teardown Lifecycle in `__tests__/db/recurring_db.test.ts`
**Profile**: Milestone 5.2 (Tier 2 E2E Test Pass - Boundary & Corner Cases)
**Verdict**: ACTIONABLE FIX STRATEGY DEFINED

---

## 1. Observation

### Phase 1: Source Code Analysis
- **`SCOPE.md` Teardown Contract**: Inspection of `.agents/sub_orch_m5_2_tier2/SCOPE.md` (lines 15-16) defines the mandatory teardown sequence:
  > "- **Teardown Sequence**: Standardized bulletproof teardown sequence across all 9 locations (`npx supabase stop`, `pkill -9 -f supabase`, `pkill -9 -f supabase-go`, `pkill -9 -f npx supabase`, `docker rm -f`, `docker volume rm -f`, `while docker ps -aq`, `fuser -k 25432/tcp`, `rm -rf supabase/.temp`, `sleep 20`) ensuring `pkill` executes after `docker rm -f` to prevent `supabase-go` daemon corruption."
- **`e2e/run_e2e.ts` Implementation**: Inspection of `e2e/run_e2e.ts` (lines 14-31) confirms a fully compliant `teardownSupabase()` function:
  ```typescript
  function teardownSupabase() {
    console.log('Performing bulletproof Supabase teardown and cleanup...');
    try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
    try { execSync('npx --no-install supabase stop --no-backup 2>/dev/null || true', { stdio: 'ignore', timeout: 10000 }); } catch(e){}
    try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
    try { execSync('docker ps -aq --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
    try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
    try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
    try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
    try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
    try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
    try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'ignore' }); } catch(e){}
    try { execSync('sleep 2', { stdio: 'inherit' }); } catch(e){}
    try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
    try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
    try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}
  }
  ```
- **`__tests__/db/recurring_db.test.ts` Flaw**: Inspection of `__tests__/db/recurring_db.test.ts` (lines 32-45) reveals the `catch (e)` block completely lacks the teardown sequence:
  ```typescript
  32:     } catch (e) {
  33:       console.log('Supabase Postgres unreachable at port 25432. Attempting to start Supabase genuinely...');
  34:       try {
  35:         execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' });
  36:         execSync('npx supabase start', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
  37:         execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
  38:         console.log('Supabase started and initialized successfully from unit test beforeAll.');
  39:         await client.connect();
  40:         isDbReachable = true;
  41:       } catch (startErr) {
  42:         console.error('Failed to start Supabase genuinely in beforeAll:', startErr);
  43:         throw startErr;
  44:       }
  45:     }
  ```

### Phase 2: Behavioral Verification & Audit Findings
- **Forensic Auditor Gen 8 Report**: Confirms `npm test` failed immediately during `jest --runInBand` at `Starting database...` with the verbatim error:
  ```json
  {"_tag":"Error","error":{"code":"PlatformError","message":"Unknown: ChildProcess.exitCode (/usr/local/google/home/duynguyenn/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-linux-x64/bin/supabase-go --output json start)"}}
  ```
- **Reviewer 2 Gen 8 Feedback**: Confirms a VETO was issued due to non-conformance with the `SCOPE.md` teardown contract (`rm -rf supabase/.temp` and `sleep 20` were omitted, causing `supabase-go` daemon corruption and `npm test` failure).

---

## 2. Logic Chain

1. **Contract Requirement**: `.agents/sub_orch_m5_2_tier2/SCOPE.md` mandates a standardized bulletproof teardown sequence across all locations to prevent `supabase-go` daemon corruption and ensure clean test execution.
2. **Root Cause of Failure**: When `npm test` executes `__tests__/db/recurring_db.test.ts`, the `beforeAll` hook attempts to connect to Postgres at port 25432. If unreachable, it enters the `catch (e)` block and directly invokes `npx supabase start`.
3. **Daemon & State Corruption**: Because lingering Docker containers, volumes, port bindings (`25432/tcp`), temporary files (`supabase/.temp`), and orphaned `supabase-go` daemon processes were not cleaned up prior to calling `npx supabase start`, `supabase-go` crashes with `PlatformError: Unknown: ChildProcess.exitCode`.
4. **Verification Chain Abortion**: The failure of `npm test` causes the short-circuit `&&` operator in the `TEST_READY.md` verification command chain to abort, preventing all subsequent E2E test scripts from running.
5. **Required Fix**: To resolve this, `__tests__/db/recurring_db.test.ts` must be updated to execute the exact bulletproof teardown sequence found in `e2e/run_e2e.ts` before calling `npx supabase start`.

---

## 3. Caveats

- **Read-Only Investigation**: As an Explorer agent operating under strict read-only constraints, no files were modified during this investigation. The recommended fix strategy must be applied by a subsequent Worker/Implementer agent.
- **Execution Environment**: The teardown sequence relies on Linux utilities (`pkill`, `fuser`, `docker`, `rm`, `sleep`). It is assumed the CI/test environment has these utilities available, which is consistent with the user's Linux OS environment.

---

## 4. Conclusion

The `INTEGRITY VIOLATION` and test failures are directly caused by the omission of the bulletproof Supabase teardown sequence in the `catch (e)` block of `__tests__/db/recurring_db.test.ts`. 

### Recommended Fix Strategy (Target: `__tests__/db/recurring_db.test.ts`)

Modify `__tests__/db/recurring_db.test.ts` lines 32-45 to insert the complete, robust teardown sequence immediately before `npx supabase start`.

```typescript
// BEFORE (lines 32-45 in __tests__/db/recurring_db.test.ts)
    } catch (e) {
      console.log('Supabase Postgres unreachable at port 25432. Attempting to start Supabase genuinely...');
      try {
        execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' });
        execSync('npx supabase start', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
        execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
        console.log('Supabase started and initialized successfully from unit test beforeAll.');
        await client.connect();
        isDbReachable = true;
      } catch (startErr) {
        console.error('Failed to start Supabase genuinely in beforeAll:', startErr);
        throw startErr;
      }
    }


// AFTER (Proposed Replacement for lines 32-45 in __tests__/db/recurring_db.test.ts)
    } catch (e) {
      console.log('Supabase Postgres unreachable at port 25432. Performing bulletproof Supabase teardown and cleanup before starting...');
      try {
        execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' });
        try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
        try { execSync('npx --no-install supabase stop --no-backup 2>/dev/null || true', { stdio: 'ignore', timeout: 10000 }); } catch(e){}
        try { execSync('sleep 5', { stdio: 'inherit' }); } catch(e){}
        try { execSync('docker ps -aq --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
        try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
        try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
        try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
        try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
        try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
        try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'ignore' }); } catch(e){}
        try { execSync('sleep 2', { stdio: 'inherit' }); } catch(e){}
        try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
        try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'ignore' }); } catch(e){}
        try { execSync('sleep 20', { stdio: 'inherit' }); } catch(e){}

        console.log('Attempting to start Supabase genuinely...');
        execSync('npx supabase start', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
        execSync('npx tsx e2e/init_db.ts', { stdio: 'inherit', env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' } });
        console.log('Supabase started and initialized successfully from unit test beforeAll.');
        await client.connect();
        isDbReachable = true;
      } catch (startErr) {
        console.error('Failed to start Supabase genuinely in beforeAll:', startErr);
        throw startErr;
      }
    }
```

---

## 5. Verification Method

After the Worker/Implementer applies the recommended fix to `__tests__/db/recurring_db.test.ts`, verify the solution using the following steps:

1. **Inspect Modified File**:
   Verify that `__tests__/db/recurring_db.test.ts` contains the complete teardown sequence (`docker rm -f`, `docker volume rm -f`, `rm -rf supabase/.temp`, `pkill -9 -f supabase-go`, `pkill -9 -f supabase`, `fuser -k 25432/tcp`, `sleep 20`) within the `catch (e)` block.

2. **Run Standalone Unit Tests**:
   Execute `npm test` to verify that `recurring_db.test.ts` successfully cleans up any lingering Supabase state, starts Supabase cleanly, and passes all test cases.
   ```bash
   npm test
   ```

3. **Execute Full Verification Command Chain**:
   Run the complete E2E verification command chain defined in `TEST_READY.md` to ensure 100% passing tests with exit code 0:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx supabase stop --no-backup 2>/dev/null || true && docker ps -aq | xargs -r docker rm -f 2>/dev/null || true && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
   ```

4. **Verify Git Cleanliness**:
   Confirm that no commits have been pushed to remote repositories:
   ```bash
   git status && git log origin/main..HEAD
   ```
