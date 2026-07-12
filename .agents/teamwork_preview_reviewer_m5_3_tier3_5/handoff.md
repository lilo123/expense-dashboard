# Handoff Report: Milestone 5.3 E2E Test Runner Review & Verification

## Review Summary

**Verdict**: REQUEST_CHANGES

## Findings

### [Critical] Finding 1

- **What**: `npx supabase start` fails with `Unrecognized flag: --v2 in command supabase start` and `Unrecognized flag: --startup-timeout in command supabase start`.
- **Where**: `e2e/run_e2e.ts` (lines 17, 69, 106, 149, 223, 228, 236) and `e2e/adv_supabase_teardown_race.ts` (lines 7, 11, 34, 40).
- **Why**: `npx supabase` is invoked without `--no-install` or a pinned version. During earlier test execution (`adv_supabase_teardown_race.ts`), `npx supabase` triggers a background check/fetch for the latest `@supabase/cli` release (`https://api.github.com/repos/supabase/cli/releases/latest`). When `e2e/run_e2e.ts` runs later, `npx` uses the newly fetched `@supabase/cli` wrapper from the npx cache (`~/.npm/_npx/aa8e5c70f9d8d161/`). The newer JavaScript wrapper passes `--v2` and `--startup-timeout` flags to the underlying `supabase-go` binary (v2.109.0), which does not support them, causing Supabase start to fail and aborting the E2E test runner with exit code 1.
- **Suggestion**: Update all invocations of `npx supabase` in `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts` to use `npx --no-install supabase` or `npx supabase@2.109.0` to prevent unmanaged wrapper updates and ensure compatibility with the local `supabase-go` binary.

## Verified Claims

- **Docker Teardown & Race Condition Fixes** → verified via `npx tsx e2e/adv_supabase_teardown_race.ts` → **PASS** (`✔ Adversarial test passed: Supabase started cleanly without container conflicts.`)
- **Unit Tests (9/9)** → verified via `npm run test __tests__/planner` → **PASS**
- **Standalone Verification Scripts** → verified via `npx tsx e2e/verify_*.ts` and `stress_test_*.ts` → **PASS**
- **100% E2E Test Pass** → verified via `exec npx tsx e2e/run_e2e.ts` → **FAIL** (Failed to start Supabase due to `Unrecognized flag: --v2`)

## Coverage Gaps

- **Unpinned npx binary execution** — risk level: **HIGH** — recommendation: **investigate / fix** (Unpinned `npx supabase` calls allow dynamic fetching of incompatible CLI wrappers during test runs).

## Unverified Items

- **Playwright E2E Tests (63/63)** — reason not verified: `e2e/run_e2e.ts` aborted during Supabase start before launching Playwright.

---

## Challenge Summary

**Overall risk assessment**: HIGH

## Challenges

### [High] Challenge 1

- **Assumption challenged**: `npx supabase` will always execute the local `supabase` binary in `node_modules/.bin` without altering flags or fetching incompatible versions.
- **Attack scenario**: `npx supabase` fetches the latest `@supabase/cli` wrapper from npm into `~/.npm/_npx/`. The latest wrapper injects `--v2` and `--startup-timeout` flags when calling `supabase start`.
- **Blast radius**: The underlying `supabase-go` binary rejects the unrecognized flags, preventing Supabase containers from starting and causing the entire E2E test suite to fail.
- **Mitigation**: Explicitly pass `--no-install` to `npx` (`npx --no-install supabase`) or pin the exact version (`npx supabase@2.109.0`).

## Stress Test Results

- **Supabase Teardown Race Condition Stress Test** → Supabase starts cleanly after repeated forced teardowns → Actual behavior: Started cleanly without container conflicts → **PASS**
- **Full E2E Test Runner Execution** → All tests pass with exit code 0 → Actual behavior: Failed with exit code 1 due to `Unrecognized flag: --v2 in command supabase start` → **FAIL**

## Unchallenged Areas

- **Playwright Browser Matrix** — reason not challenged: Supabase failed to start, preventing Next.js server and Playwright execution.

---

## 1. Observation
- **Execution**: Executed the master E2E test runner command defined in `TEST_READY.md`: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run test __tests__/planner && npx tsx e2e/adv_supabase_teardown_race.ts && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts`.
- **Unit & Standalone Tests**: Observed that `npm run test __tests__/planner` passed (9/9 tests), `npx tsx e2e/adv_supabase_teardown_race.ts` passed, and all standalone verification scripts passed successfully.
- **E2E Runner Failure**: Observed that `exec npx tsx e2e/run_e2e.ts` failed with exit code 1.
- **Verbatim Errors**: Observed the following verbatim errors in `task-14.log`:
  ```json
  {"_tag":"Errors","errors":[{"code":"UnrecognizedOption","message":"Unrecognized flag: --v2 in command supabase start\n\n  Did you mean this?\n    -x"},{"code":"UnrecognizedOption","message":"Unrecognized flag: --startup-timeout in command supabase start"}]}
  {"_tag":"Error","error":{"code":"ShowHelp","message":"Help requested"}}
  ```
  ```
  failed to inspect container health: Error response from daemon: No such container: supabase_db_expense-dashboard
  Try rerunning the command with --debug to troubleshoot the error.
  Supabase status check failed.
  Performing bulletproof Supabase teardown and cleanup...
  ⣽ Stopping containers...Stopped supabase local development setup.
  Failed to start Supabase after 3 outer attempts.
  ```
- **Codebase Inspection**: Observed in `e2e/run_e2e.ts` (lines 17, 69, 106, 149, 223, 228, 236) and `e2e/adv_supabase_teardown_race.ts` (lines 7, 11, 34, 40) that `npx supabase` is invoked without `--no-install` or a pinned version flag.
- **Network/Update Activity**: Observed in `task-14.log` during `e2e/adv_supabase_teardown_race.ts` execution: `2026/07/07 07:57:55 HTTP GET: https://api.github.com/repos/supabase/cli/releases/latest`.

## 2. Logic Chain
1. **Unpinned npx Invocations**: `npx supabase start` is called without `--no-install` or a pinned version in `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts`.
2. **Background CLI Fetch**: During `e2e/adv_supabase_teardown_race.ts`, `npx supabase` executes `Supabase CLI 2.109.0` but triggers a background check/fetch for the latest Supabase CLI release (`https://api.github.com/repos/supabase/cli/releases/latest`).
3. **Incompatible Wrapper Execution**: When `e2e/run_e2e.ts` executes later in the test chain, `npx supabase start` invokes the newly fetched `@supabase/cli` wrapper from the `npx` cache (`~/.npm/_npx/aa8e5c70f9d8d161/`).
4. **Flag Mismatch & Failure**: The newer `@supabase/cli` JavaScript wrapper passes `--v2` and `--startup-timeout` flags to the underlying `supabase-go` binary. The underlying `supabase-go` binary (version 2.109.0) does not support `--v2` and `--startup-timeout`, causing `supabase start` to fail with `Unrecognized flag: --v2 in command supabase start` and aborting the E2E test runner.
5. **Required Fix**: To fix this, all invocations of `npx supabase` in `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts` must be pinned or forced to use the local version (e.g., `npx --no-install supabase` or `npx supabase@2.109.0`).

## 3. Caveats
- No caveats. The failure mechanism was directly observed in the `task-14.log` output and verified through the exact error messages from `supabase-go`.

## 4. Conclusion
**Verdict: REQUEST_CHANGES**. Worker 3's changes successfully resolved the Docker teardown race conditions and `supabase-go --rm` container conflicts, but the unpinned `npx supabase` commands introduce an unmanaged dependency update failure (`Unrecognized flag: --v2`). All `npx supabase` calls in `e2e/run_e2e.ts` and `e2e/adv_supabase_teardown_race.ts` must be updated to `npx --no-install supabase` or `npx supabase@2.109.0`.

## 5. Verification Method
To independently verify the correctness and robustness of the implementation once the fixes are applied, execute the master E2E test runner command defined in `TEST_READY.md`:

```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npm run test __tests__/planner && npx tsx e2e/adv_supabase_teardown_race.ts && npx tsx e2e/verify_global_market_data.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_combinations.ts && npx tsx e2e/stress_test_m4.ts && npx tsx e2e/stress_test_m4_edge_cases.ts && npx tsx e2e/adv_planner_gaps.ts && exec npx tsx e2e/run_e2e.ts
```

**Expected Result**: All tests pass with exit code 0 and no `Unrecognized flag: --v2` errors occur during `supabase start`.
