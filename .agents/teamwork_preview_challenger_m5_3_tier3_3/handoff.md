# Handoff Report: Milestone 5.3 Empirical Verification & Teardown Flaw Analysis

## 1. Observation
- **Documentation & Scope**: Reviewed `PROJECT.md`, `SCOPE.md`, `TEST_READY.md`, and Worker 2's `handoff.md`. Worker 2 claimed that removing `pkill -9 -f "supabase"` entirely from `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts` eliminated the "Suicide Bug" while maintaining clean teardowns.
- **Standalone Verification**: Executed `e2e/adv_supabase_teardown_race.ts` via `task-24`, which completed successfully with exit code 0.
- **Full E2E Test Runner Execution**: Executed the master E2E test runner command defined in `TEST_READY.md` (`export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts`) via `task-29`.
- **Empirical Failure Observed**: While all standalone verification scripts (`verify_*.ts`, `stress_test_*.ts`, `adv_planner_gaps.ts`) passed successfully, `exec npx tsx e2e/run_e2e.ts` failed with exit code 1.
- **Log Analysis (`task-29.log`)**:
  - During `Supabase start inner attempt 1/3`, `npx supabase start` immediately aborted with:
    ```
    supabase start is already running.
    Stopped services: [supabase_kong_expense-dashboard supabase_auth_expense-dashboard supabase_inbucket_expense-dashboard supabase_realtime_expense-dashboard supabase_rest_expense-dashboard supabase_storage_expense-dashboard supabase_imgproxy_expense-dashboard supabase_pg_meta_expense-dashboard supabase_studio_expense-dashboard supabase_edge_runtime_expense-dashboard supabase_analytics_expense-dashboard supabase_vector_expense-dashboard supabase_pooler_expense-dashboard]
    ```
    Because the services were actually stopped, `http://127.0.0.1:54321` was unreachable, causing the 30-second verification loop to fail.
  - During subsequent retry attempts (`Supabase start outer attempt 3/3`), `npx supabase start` failed with a Docker container conflict:
    ```
    failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container "2dc61be4572c1fc6dd80bf985a0491ee9825d8230f58380112079597898b7838". You have to remove (or rename) that container to be able to reuse that name.
    ```

## 2. Logic Chain
1. **Worker 2's Flawed Assumption**: Worker 2 assumed that removing `pkill -9 -f "supabase"` was necessary to prevent `adv_supabase_teardown_race.ts` from killing itself (the "Suicide Bug"). Worker 2 assumed that `pkill -9 -f "supabase-go"` and `pkill -9 -f "npx supabase"` would be sufficient to clean up Supabase background processes.
2. **Surviving Supabase CLI Daemon**: In the `@supabase/cli` package (v2.109.0), the actual binary executed is named `supabase` (e.g., `node_modules/@supabase/cli-linux-x64/bin/supabase`), NOT `supabase-go`. Because `pkill -9 -f "supabase"` was removed entirely, the background `supabase` binary/daemon remains alive across teardowns.
3. **State Corruption & Container Conflicts**: The surviving `supabase` background process retains internal file locks and actively attempts to manage or recreate containers in the background. When `run_e2e.ts` calls `teardownSupabase()` followed by `npx supabase start`, the surviving daemon interferes with the new `supabase start` process. This causes the CLI to falsely report `supabase start is already running. Stopped services: [...]` or results in `Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use` as both processes attempt to create containers concurrently.
4. **Required Mitigation**: To achieve a genuinely bulletproof teardown without triggering the Suicide Bug (killing `run_e2e.ts` or `adv_supabase_teardown_race.ts`), the `pkill` command must specifically target the Supabase CLI binary rather than matching the broad `supabase` string in test filenames. Replacing the removed `pkill` with `pkill -9 -f "bin/supabase"` or `pkill -9 -x "supabase"` will successfully terminate the background CLI daemon while leaving the TypeScript test runners intact.

## 3. Caveats
- As an EMPIRICAL CHALLENGER under review-only constraints, I am prohibited from modifying implementation code (`e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts`). The required fix must be implemented by a worker agent in the next iteration of the M5.3 loop.

## 4. Conclusion
Worker 2's implementation of the Supabase teardown sequence contains a critical flaw. Completely removing `pkill -9 -f "supabase"` leaves the Supabase CLI background binary (`bin/supabase`) alive, which corrupts the teardown sequence, causes Docker container name conflicts, and prevents `run_e2e.ts` from successfully starting Supabase. The E2E test runner fails with exit code 1.

## 5. Verification Method
To independently verify the failure and test future fixes, execute the master E2E test runner command defined in `TEST_READY.md`:

```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
```

**Expected Result (Current State)**: All standalone verification scripts pass, but `exec npx tsx e2e/run_e2e.ts` fails with `supabase start is already running. Stopped services: [...]` or `Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use`.

**Expected Result (Post-Fix)**: Once `pkill -9 -f "bin/supabase"` or `pkill -9 -x "supabase"` is added to `teardownSupabase()`, `exec npx tsx e2e/run_e2e.ts` will successfully start Supabase, execute the Playwright test suite, and exit with code 0.
