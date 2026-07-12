# Handoff Report: Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations)

## Review Summary

**Verdict**: REQUEST_CHANGES

## 1. Observation
- **Documentation & Scope**: Reviewed `PROJECT.md`, `SCOPE.md`, `TEST_READY.md`, `ORIGINAL_REQUEST.md`, and Worker 1's handoff report. Milestone 5.3 requires 100% passing Tier 3 E2E tests (Cross-Feature Combinations) with exit code 0.
- **Code Inspection**: Examined `e2e/run_e2e.ts`, `e2e/adv_supabase_teardown_race.ts`, `e2e/verify_tier3_combinations.ts`, `e2e/verify_tier3_interactions.ts`, and `src/workers/simulation.worker.ts`.
  - Worker 1 correctly implemented the 8 pairwise combination checks without any integrity violations (no hardcoded test results or dummy implementations).
  - Worker 1 correctly reordered `pkill -9` before `docker rm -f` in `teardownSupabase()`.
- **Verification Execution (`task-17`)**: Ran `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run test __tests__/planner && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts`.
- **Verification Result**: The command failed with exit code 1.
  - Unit tests (`npm run test __tests__/planner`) PASSED (9/9 tests).
  - All standalone verification scripts (`verify_global_market_data.ts`, `verify_accumulation.ts`, `verify_monte_carlo.ts`, `verify_tier3_combinations.ts`, `stress_test_m4.ts`, `stress_test_m4_edge_cases.ts`, `adv_planner_gaps.ts`) PASSED.
  - `exec npx tsx e2e/run_e2e.ts` FAILED during Supabase startup with the following errors:
    ```
    supabase start is already running.
    Stopped services: [supabase_kong_expense-dashboard ...]
    supabase local development setup is running.
    ...
    Verifying Supabase is reachable before confirming start...
    Supabase start attempt 1 failed. Checking status and cleaning up before retry...
    failed to inspect container health: Error response from daemon: No such container: supabase_db_expense-dashboard
    ```

## 2. Logic Chain
1. **Supabase Lockfile Persistence**: `e2e/adv_supabase_teardown_race.ts` executes `npx supabase start --ignore-health-check` and exits with code 0 without stopping Supabase. When `e2e/run_e2e.ts` runs immediately afterward, it invokes `teardownSupabase()`.
2. **pkill vs Lockfile Cleanup**: `teardownSupabase()` executes `pkill -9 -f "supabase"`. Because `SIGKILL` (-9) terminates the Supabase CLI instantly, Supabase cannot perform its own cleanup of the lockfile located at `$HOME/.supabase/supabase.lock`.
3. **Shell Tilde Expansion Failure**: `teardownSupabase()` attempts to remove the lockfile via `execSync('rm -rf supabase/.temp ~/.supabase/supabase.lock /tmp/supabase.lock 2>/dev/null || true')`. However, `execSync` defaults to `/bin/sh` (which is `dash` on Ubuntu/Linux). `/bin/sh` does NOT perform tilde (`~`) expansion. Consequently, `rm -rf ~/.supabase/supabase.lock` literally attempts to remove a directory named `~`, leaving `/usr/local/google/home/duynguyenn/.supabase/supabase.lock` untouched.
4. **False Running State**: When `npx supabase start --debug --ignore-health-check` is subsequently called, Supabase CLI detects the orphaned lockfile (`$HOME/.supabase/supabase.lock`), falsely concludes `supabase start is already running.`, refuses to spawn new Docker containers, and exits. `run_e2e.ts` then fails because `supabase_db_expense-dashboard` does not exist.

## 3. Findings

### [Critical] Finding 1: Supabase Teardown Lockfile Leaking / Shell Expansion Failure
- **What**: `e2e/run_e2e.ts` fails during `npx supabase start` with `supabase start is already running.` followed by `failed to inspect container health: Error response from daemon: No such container: supabase_db_expense-dashboard`.
- **Where**: `e2e/run_e2e.ts` (line 21) and `e2e/adv_supabase_teardown_race.ts`.
- **Why**: `execSync` uses `/bin/sh` by default, which does not perform tilde (`~`) expansion. Therefore, `rm -rf supabase/.temp ~/.supabase/supabase.lock /tmp/supabase.lock` fails to remove `/usr/local/google/home/duynguyenn/.supabase/supabase.lock`. When `e2e/adv_supabase_teardown_race.ts` starts Supabase and exits without stopping it, `e2e/run_e2e.ts` executes `pkill -9 -f "supabase"`, leaving the lockfile orphaned in `$HOME/.supabase/supabase.lock`.
- **Suggestion**: Replace `~/.supabase/supabase.lock` with `$HOME/.supabase/supabase.lock` in `e2e/run_e2e.ts` (line 21) and ensure `rm -rf` correctly evaluates `$HOME`. Also add `rm -rf $HOME/.supabase/supabase.lock` to `e2e/adv_supabase_teardown_race.ts`.

## 4. Caveats
- No caveats. The failure was directly observed in the task execution logs (`task-17.log`).

## 5. Conclusion
Milestone 5.3 cannot be approved in its current state due to E2E test runner failure (exit code 1). Worker 1 must update `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts` to use `$HOME/.supabase/supabase.lock` instead of `~/.supabase/supabase.lock` to ensure bulletproof teardown across sequential test script executions.

## 6. Verification Method
To independently verify the fix, execute the master E2E test runner command defined in `TEST_READY.md`:

```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run test __tests__/planner && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
```

**Expected Result**: All verification scripts, Tier 3 combination tests, adversarial checks, and Playwright E2E tests execute successfully, terminating with exit code 0.
