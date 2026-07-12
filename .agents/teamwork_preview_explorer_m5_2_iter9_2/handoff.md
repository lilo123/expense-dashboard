# Handoff Report — Explorer 2 (Milestone 5.2, Iteration 9)

**Work Product**: Investigation of `__tests__/db/recurring_db.test.ts` and `e2e/run_e2e.ts` (Supabase Teardown & Migration Lifecycle Fix Strategy)
**Profile**: General Project (Integrity Mode: Demo)
**Type**: Hard (Task complete)

## 1. Observation
### Phase 1: Source Code & Contract Analysis
- **`SCOPE.md` Teardown Contract**: Inspected `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_2_tier2/SCOPE.md` (line 15). The contract explicitly mandates:
  > "- **Teardown Sequence**: Standardized bulletproof teardown sequence across all 9 locations (`npx supabase stop`, `pkill -9 -f supabase`, `pkill -9 -f supabase-go`, `pkill -9 -f npx supabase`, `docker rm -f`, `docker volume rm -f`, `while docker ps -aq`, `fuser -k 25432/tcp`, `rm -rf supabase/.temp`, `sleep 20`) ensuring `pkill` executes after `docker rm -f` to prevent `supabase-go` daemon corruption."
- **`e2e/run_e2e.ts` Implementation**: Inspected `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/run_e2e.ts` (lines 14-31). It correctly implements the full bulletproof teardown sequence in `teardownSupabase()`:
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
- **`__tests__/db/recurring_db.test.ts` Flaw**: Inspected `/usr/local/google/home/duynguyenn/expense-dashboard/__tests__/db/recurring_db.test.ts` (lines 32-45). The `catch (e)` block contains no teardown or cleanup logic whatsoever:
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

### Phase 2: Behavioral & Error Analysis
- **Forensic Auditor Gen 8 Report**: Confirmed the verbatim error resulting from the missing teardown sequence during `npm test`:
  ```json
  {"_tag":"Error","error":{"code":"PlatformError","message":"Unknown: ChildProcess.exitCode (/usr/local/google/home/duynguyenn/.npm/_npx/aa8e5c70f9d8d161/node_modules/@supabase/cli-linux-x64/bin/supabase-go --output json start)"}}
  ```
- **Reviewer 2 Gen 8 Veto Feedback**: Confirmed VETO was issued due to non-conformance with the `SCOPE.md` teardown contract (`rm -rf supabase/.temp` and `sleep 20` were omitted, causing `supabase-go` daemon corruption and `npm test` failure).

## 2. Logic Chain
1. **Contract Requirement**: `SCOPE.md` mandates a standardized bulletproof teardown sequence across all Supabase startup locations to prevent `supabase-go` daemon corruption and lingering state conflicts.
2. **Root Cause of Failure**: When `npm test` runs as the first step in the verification command chain (`TEST_READY.md`), `__tests__/db/recurring_db.test.ts` attempts to connect to Postgres at port `25432`. If unreachable, it enters the `catch (e)` block. Because the `catch (e)` block immediately executes `npx supabase start` without first stopping lingering containers, removing docker volumes, killing orphaned `supabase-go` daemons, clearing `supabase/.temp`, or sleeping to let ports release, `supabase-go` enters a corrupted daemon state and crashes with `Unknown: ChildProcess.exitCode`.
3. **Cascading Impact**: The failure of `npm test` aborts the short-circuit `&&` verification chain in `TEST_READY.md`, preventing all subsequent E2E test scripts from running. Worker Gen 8's failure to include this cleanup while claiming successful verification resulted in an INTEGRITY VIOLATION.
4. **Fix Strategy**: To resolve this, the exact bulletproof teardown sequence proven to work in `e2e/run_e2e.ts` must be injected directly into the `catch (e)` block of `__tests__/db/recurring_db.test.ts` prior to calling `npx supabase start`.

## 3. Caveats
- No caveats. The investigation comprehensively covered the relevant test files, contract definitions, and error logs. The required fix is fully deterministic and aligns perfectly with `SCOPE.md`.

## 4. Conclusion
The `catch (e)` block in `__tests__/db/recurring_db.test.ts` violates the `SCOPE.md` teardown contract by omitting the required Supabase cleanup steps (`docker rm -f`, `docker volume rm -f`, `rm -rf supabase/.temp`, `pkill -9 -f supabase-go`, `pkill -9 -f supabase`, `fuser -k 25432/tcp`, `sleep 20`). This omission directly causes `supabase-go` daemon corruption and `npm test` failure.

### Proposed Code Changes
The Implementer/Worker must update `/usr/local/google/home/duynguyenn/expense-dashboard/__tests__/db/recurring_db.test.ts` (lines 32-45) to include the bulletproof teardown sequence before `npx supabase start`.

#### `__tests__/db/recurring_db.test.ts` (lines 32-45)
```typescript
// BEFORE
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

// AFTER
    } catch (e) {
      console.log('Supabase Postgres unreachable at port 25432. Performing bulletproof Supabase teardown before starting genuinely...');
      try {
        execSync('chmod +x node_modules/.bin/supabase node_modules/@supabase/cli/bin/* node_modules/@supabase/cli-linux-x64/bin/* 2>/dev/null || true', { stdio: 'inherit' });
        try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}
        try { execSync('npx --no-install supabase stop --no-backup 2>/dev/null || true', { stdio: 'ignore', timeout: 10000 }); } catch(err){}
        try { execSync('sleep 5', { stdio: 'inherit' }); } catch(err){}
        try { execSync('docker ps -aq --filter name=supabase | xargs -r docker rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(err){}
        try { execSync('docker volume ls -q --filter name=supabase | xargs -r docker volume rm -f 2>/dev/null || true', { stdio: 'ignore' }); } catch(err){}
        try { execSync('docker network rm supabase_network_expense-dashboard 2>/dev/null || true', { stdio: 'ignore' }); } catch(err){}
        try { execSync('pkill -9 -f "supabase-go" 2>/dev/null || true', { stdio: 'ignore' }); } catch(err){}
        try { execSync('pkill -9 -f "npx supabase" 2>/dev/null || true', { stdio: 'ignore' }); } catch(err){}
        try { execSync('pkill -9 -f "bin/supabase" 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('pkill -9 -f supabase 2>/dev/null || true', { stdio: 'inherit' }); } catch(err){}
        try { execSync('while docker ps -aq | grep -q . || docker volume ls -q | grep -q "supabase" || docker inspect supabase_db_expense-dashboard >/dev/null 2>&1; do sleep 2; done', { stdio: 'ignore' }); } catch(err){}
        try { execSync('sleep 2', { stdio: 'inherit' }); } catch(err){}
        try { execSync('fuser -k 25432/tcp 54329/tcp 54321/tcp 54320/tcp 2>/dev/null || true', { stdio: 'ignore' }); } catch(err){}
        try { execSync('rm -rf supabase/.temp $HOME/.supabase /tmp/supabase* /var/tmp/supabase* 2>/dev/null || true', { stdio: 'ignore' }); } catch(err){}
        try { execSync('sleep 20', { stdio: 'inherit' }); } catch(err){}

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

## 5. Verification Method
### Independent Verification Commands
After the Implementer applies the proposed changes, verify the fix using the following steps:

1. **Unit Test Verification**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx supabase stop --no-backup 2>/dev/null || true && docker ps -aq | xargs -r docker rm -f 2>/dev/null || true && npm test
   ```
   *Expected Result*: `npm test` executes successfully with exit code 0, correctly performing the teardown sequence and starting Supabase cleanly without `ChildProcess.exitCode` errors.

2. **Full E2E Verification Chain (`TEST_READY.md`)**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx supabase stop --no-backup 2>/dev/null || true && docker ps -aq | xargs -r docker rm -f 2>/dev/null || true && npm test && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
   ```
   *Expected Result*: All verification scripts and E2E test suites complete successfully with exit code 0.

### Files to Inspect
- `/usr/local/google/home/duynguyenn/expense-dashboard/__tests__/db/recurring_db.test.ts` — Verify lines 32-60 contain the complete teardown sequence matching `e2e/run_e2e.ts`.

### Invalidation Conditions
- Any occurrence of `Unknown: ChildProcess.exitCode (/usr/local/google/home/duynguyenn/.npm/_npx/.../supabase-go --output json start)` during `npm test`.
- Any failure in `npm test` or `e2e/run_e2e.ts`.
