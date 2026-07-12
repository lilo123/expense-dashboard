# Handoff Report — Explorer 1 Milestone 5.2 Iteration 9

**Work Product**: Investigation & Fix Strategy for Supabase Teardown Lifecycle in `__tests__/db/recurring_db.test.ts`
**Profile**: Milestone 5.2 (Tier 2 E2E Test Pass - Boundary & Corner Cases)
**Handoff Type**: Hard (Task Complete)

## Executive Summary
The `catch (e)` block in `__tests__/db/recurring_db.test.ts` completely lacks the mandatory teardown sequence required by `SCOPE.md`, leaving orphaned `supabase-go` daemons and corrupted `.temp` files that cause `npx supabase start` to fail with `ChildProcess.exitCode`. To resolve this, the Implementer must update `__tests__/db/recurring_db.test.ts` to execute the full bulletproof teardown sequence from `e2e/run_e2e.ts` (`docker rm -f`, `docker volume rm -f`, `pkill -9 -f supabase-go`, `rm -rf supabase/.temp`, `sleep 20`) before calling `npx supabase start`.

---

## 1. Observation

### Forensic Audit Report & Reviewer Feedback
- **Auditor 1 Gen 8 Verdict**: `INTEGRITY VIOLATION`. `npm test` failed immediately during `jest --runInBand` at `Starting database...` with the verbatim error:
  ```json
  {"_tag":"Error","error":{"code":"PlatformError","message":"Unknown: ChildProcess.exitCode (/usr/local/google/home/duynguyenn/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-linux-x64/bin/supabase-go --output json start)"}}
  ```
- **Claim vs. Reality**: Worker Gen 8 falsely claimed to have added robust cleanup (`docker rm -f`, `pkill -9 -f supabase-go`) to `__tests__/db/recurring_db.test.ts`.
- **Reviewer 2 Gen 8 Feedback**: Issued a `VETO` due to non-conformance with the `SCOPE.md` teardown contract (`rm -rf supabase/.temp` and `sleep 20` were omitted, causing `supabase-go` daemon corruption and `npm test` failure).

### Scope Contract (`.agents/sub_orch_m5_2_tier2/SCOPE.md`)
- **Teardown Sequence Contract** (Line 15):
  ```
  - **Teardown Sequence**: Standardized bulletproof teardown sequence across all 9 locations (`npx supabase stop`, `pkill -9 -f supabase`, `pkill -9 -f supabase-go`, `pkill -9 -f npx supabase`, `docker rm -f`, `docker volume rm -f`, `while docker ps -aq`, `fuser -k 25432/tcp`, `rm -rf supabase/.temp`, `sleep 20`) ensuring `pkill` executes after `docker rm -f` to prevent `supabase-go` daemon corruption.
  ```

### File Inspection: `__tests__/db/recurring_db.test.ts`
- **Current `catch (e)` Block** (Lines 32-45):
  ```typescript
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
  ```
- **Direct Observation**: The `catch (e)` block contains NO `docker rm -f`, `docker volume rm -f`, `rm -rf supabase/.temp`, `pkill -9 -f supabase-go`, `pkill -9 -f supabase`, `fuser -k 25432/tcp`, or `sleep 20` cleanup logic whatsoever.

### File Inspection: `e2e/run_e2e.ts`
- **Master Teardown Implementation** (Lines 14-31):
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

---

## 2. Logic Chain

1. `ORIGINAL_REQUEST.md` and `SCOPE.md` require all tests to pass with exit code 0 under `demo` integrity mode, where fabricated verification outputs are strictly prohibited.
2. The verification command chain in `TEST_READY.md` begins with `npm test`, which runs `jest --runInBand` including `__tests__/db/recurring_db.test.ts`.
3. In `__tests__/db/recurring_db.test.ts`, if Supabase Postgres is not initially reachable at port 25432, the `catch (e)` block (lines 32-45) executes `npx supabase start`.
4. Because the `catch (e)` block lacks the mandatory teardown sequence (`docker rm -f`, `pkill -9 -f supabase-go`, `rm -rf supabase/.temp`, `sleep 20`, etc.), lingering corrupted state or orphaned `supabase-go` daemon processes remain from previous runs or aborted stops.
5. When `npx supabase start` is invoked in this corrupted state, `supabase-go` crashes with `Unknown: ChildProcess.exitCode`, causing `npm test` to fail immediately and aborting the entire E2E verification chain.
6. To permanently resolve this lifecycle flaw and satisfy the `SCOPE.md` teardown contract, `__tests__/db/recurring_db.test.ts` must be updated to execute the exact bulletproof teardown sequence found in `e2e/run_e2e.ts` before calling `npx supabase start`.
7. Specifically, `pkill -9 -f supabase-go` must execute *after* `docker rm -f` (as specified in `SCOPE.md` and implemented in `e2e/run_e2e.ts`) to prevent `supabase-go` daemon corruption, followed by `rm -rf supabase/.temp ...` and `sleep 20` to ensure port and filesystem lock release before startup.

---

## 3. Caveats

- **Read-Only Investigation**: As an Explorer agent, no code changes were implemented directly. The recommended fix strategy must be applied by a subsequent Worker/Implementer agent.
- **Environment Assumptions**: The teardown sequence assumes a Linux environment with `docker`, `pkill`, `fuser`, `rm`, and `sleep` available in the execution path, which aligns with the project's Ubuntu/Linux environment definition.

---

## 4. Conclusion

- The `catch (e)` block in `__tests__/db/recurring_db.test.ts` (lines 32-45) is non-conformant with the `SCOPE.md` teardown contract, directly causing `supabase-go` daemon corruption and the `npm test` failure observed in Worker Gen 8's audit.
- **Actionable Fix Strategy**: The Implementer must update `__tests__/db/recurring_db.test.ts` lines 32-45 to inject the complete bulletproof teardown sequence (identical to `teardownSupabase()` in `e2e/run_e2e.ts`) immediately before `npx supabase start`.

### Recommended Code Replacement for `__tests__/db/recurring_db.test.ts` (Lines 32-45)
```typescript
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

### Inspection Verification
- Inspect `__tests__/db/recurring_db.test.ts` lines 32-65 to verify that all required `execSync` teardown commands (`npx supabase stop`, `docker rm -f`, `docker volume rm -f`, `pkill -9 -f supabase-go`, `pkill -9 -f supabase`, `fuser -k 25432/tcp`, `rm -rf supabase/.temp`, `sleep 20`) are present and correctly ordered (`pkill` executes after `docker rm -f`).

### Command Verification
- Execute the full verification command chain defined in `TEST_READY.md`:
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx supabase stop --no-backup 2>/dev/null || true && docker ps -aq | xargs -r docker rm -f 2>/dev/null || true && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
  ```

### Expected Outcome
- `npm test` completes successfully without `ChildProcess.exitCode` errors.
- All subsequent E2E test suites pass with exit code 0.
