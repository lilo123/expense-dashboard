# Handoff Report: M5.3 Supabase Reachability & Config Fix Strategy

## 1. Observation
- **File**: `/usr/local/google/home/duynguyenn/expense-dashboard/e2e/adv_supabase_dns_nxdomain.ts`
  - **Lines 64-77**:
    ```typescript
    console.log('Verifying Supabase is reachable...');
    let checkRetries = 30;
    let reachable = false;
    while (checkRetries > 0 && !reachable) {
      try {
        const res = await fetch('http://127.0.0.1:54321');
        if (res.ok || res.status === 404 || res.status === 400 || res.status === 200) {
          reachable = true;
          break;
        }
      } catch (e) {}
      await new Promise(resolve => setTimeout(resolve, 1000));
      checkRetries--;
    }
    ```
  - **Lines 83-85**:
    ```typescript
    } else {
      throw new Error('Supabase started but http://127.0.0.1:54321 is unreachable.');
    }
    ```
- **Iteration 5 Reviewer Findings**:
  - Reviewer 1 gen5: `npx tsx e2e/adv_supabase_dns_nxdomain.ts` failed with exit code 1 (`http://127.0.0.1:54321` is unreachable).
  - Reviewer 2 gen5: `e2e/adv_supabase_dns_nxdomain.ts` deterministically fails due to a 30-second reachability timeout (`checkRetries = 30`), whereas Supabase containers take ~40-50 seconds to become healthy.
- **File**: `/usr/local/google/home/duynguyenn/expense-dashboard/supabase/config.toml`
  - **Line 6**: Currently empty (`6:`).
  - **Lines 27-33**:
    ```toml
    [db]
    # Port to use for the local database URL.
    port = 25432
    # Port used by db diff command to initialize the shadow database.
    shadow_port = 54320
    # Maximum amount of time to wait for health check when starting the local database.
    health_timeout = "10m"
    ```
- **Iteration 5 Challenger Findings**:
  - Challenger 1 gen5: `supabase/config.toml` contains an invalid top-level key `health_timeout = "5m"` at line 6, causing `npx supabase start` to fail fatally with `'config.config' has invalid keys: health_timeout`.
  - Challenger 2 gen5: `e2e/adv_supabase_dns_nxdomain.ts` failed with exit code 1.
- **Forensic Auditor gen5 Evidence Report**: Reported CLEAN. Confirmed that all Supabase teardown filtering logic (`ps aux | grep ... | grep -v ... | xargs kill -9`) and inner try-catch blocks were verified as exact drop-in replacements. Forensic source code analysis confirmed all permissions and implementations are genuine with no hardcoded test results or facade implementations.

## 2. Logic Chain
1. **Timeout Mismatch**: `e2e/adv_supabase_dns_nxdomain.ts` configures `checkRetries = 30` with a 1000ms sleep per iteration, establishing a hard 30-second timeout for `http://127.0.0.1:54321` to become reachable.
2. **Premature Teardown**: Because Supabase containers require ~40-50 seconds to initialize and become healthy in this environment, the 30-second reachability check consistently expires while Supabase is still starting up.
3. **Deterministic Failure Loop**: When `checkRetries` reaches 0, the script throws an error (`Supabase started but http://127.0.0.1:54321 is unreachable.`), catches it in the outer loop, and immediately executes `teardownSupabase()`. This destroys the initializing containers before they can finish starting, causing all 5 outer retries to fail deterministically.
4. **Invalid Config Root Cause**: In Iteration 5, a previous Worker attempted to address the timeout by adding `health_timeout = "5m"` at line 6 (top-level) of `supabase/config.toml`. In Supabase CLI configuration, `health_timeout` is not a valid top-level key; it must be placed under the `[db]` table. This caused `npx supabase start` to fail fatally with `'config.config' has invalid keys: health_timeout`.
5. **Current Config Validity**: In the current `supabase/config.toml`, line 6 is empty and `health_timeout = "10m"` is correctly configured under `[db]` at line 33. Therefore, `supabase/config.toml` is currently valid and does not require modification.

## 3. Caveats
- **Assumptions**: We assume Supabase container startup time (~40-50 seconds) remains consistent and does not exceed 90 seconds under heavier system load.
- **Scope**: Investigation was performed read-only within the M5.3 scope boundaries as defined in `SCOPE.md`. No active container execution or test runs were performed by the Explorer.

## 4. Conclusion
The Worker in Iteration 6 should implement the following surgical fix strategy:

1. **Modify `e2e/adv_supabase_dns_nxdomain.ts`**:
   - Update line 65 to increase `checkRetries` from `30` to `90` (providing a 90-second window for Supabase reachability).
   ```typescript
   // Before (line 65)
   let checkRetries = 30;

   // After (line 65)
   let checkRetries = 90;
   ```

2. **Maintain `supabase/config.toml`**:
   - Keep `supabase/config.toml` exactly as it is, ensuring `health_timeout = "10m"` remains under `[db]` at line 33 and no top-level keys are added at line 6.

## 5. Verification Method
The Worker should verify the fix by executing the following commands:

1. **Verify the standalone adversarial test**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/adv_supabase_dns_nxdomain.ts
   ```
   - **Expected Result**: Script completes successfully with exit code 0 and logs `✔ Supabase started successfully without DNS nxdomain errors.`

2. **Verify the full Tier 3 E2E test suite**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
   ```
   - **Expected Result**: All tests pass with exit code 0. Zero TypeScript errors. Flawless CLEAN audit verdict.

3. **Inspect `supabase/config.toml`**:
   - Ensure `npx supabase start --debug` does not throw any invalid key errors for `health_timeout`.
