# Handoff Report — Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations)

## 1. Observation
During our investigation of the codebase for Milestone 5.3 (`M5.3: Tier 3 E2E Test Pass - Cross-Feature Combinations`), we executed the test runner commands and performed comprehensive file tree and content inspections. We directly observed the following:

### A. Test Execution Results
- **`e2e/run_e2e.ts` Failure**: Executing `npx tsx e2e/run_e2e.ts` failed with exit code 1. The verbatim error log shows:
  ```
  failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container "5f371c3d0d25a954add2ac1bd4ee1aa11ad9b09e9344cf87c4d1f9922d1269b6". You have to remove (or rename) that container to be able to reuse that name.
  Supabase start attempt 2 failed. Checking status and cleaning up before retry...
  Supabase status check failed.
  Supabase start attempt 3/3...
  ...
  Failed to start Supabase after 3 attempts.
  ```
- **Verification Scripts Pass**: Executing `npx tsx e2e/verify_accumulation.ts`, `npx tsx e2e/verify_monte_carlo.ts`, and `npx tsx e2e/adv_planner_gaps.ts` directly completed successfully with exit code 0.
  - `verify_accumulation.ts`: `=== [E2E VERIFICATION] Accumulation Verification PASSED ===`
  - `verify_monte_carlo.ts`: `=== [E2E VERIFICATION] Monte Carlo Verification PASSED ===`
  - `adv_planner_gaps.ts`: `=== [ADVERSARIAL AUDIT] Completed with 0 failures ===`

### B. Codebase Gaps & Missing Files
A recursive file listing (`ls -R`) and keyword search (`awk`) across `src/`, `supabase/`, and `e2e/` revealed significant missing implementation files required by `PROJECT.md` and `SCOPE.md`:
- **Missing UI Component**: `src/components/QuickCheckWidget.tsx` does not exist.
- **Missing State Store**: `useRetirementStore.tsx` does not exist in `src/store/` (only `useExpenseStore.tsx` is present).
- **Missing Server Actions**: `src/actions/retirementActions.ts` (or `src/app/actions/retirementActions.ts`) does not exist.
- **Missing Tier 3 Test Suite**: There is no Playwright test file in `e2e/` implementing the 8 Tier 3 test cases for pairwise feature interactions (e.g., `e2e/tier3_cross_feature.spec.ts`). Existing spec files (`dashboard.spec.ts`, `settings.spec.ts`, `modals_ui.spec.ts`, `currency.spec.ts`, `budget_planner_propagation.spec.ts`, `yearly_master_toggle.spec.ts`, `auth.spec.ts`, `chat.spec.ts`, `recurring.spec.ts`, `recent_filters.spec.ts`, `onboarding_safeguards.spec.ts`, `offline_mutation_resilience.spec.ts`, `budget_streaming_suspense.spec.ts`, `budget_month_picker.spec.ts`, `invite_workflow.spec.ts`) contain zero references to `QuickCheckWidget`, `Scrambled Monte Carlo`, `drawdown engine`, or `Calculator` pairwise interactions.

### C. Database & Backend State
- **Supabase Migrations**: `supabase/migrations/20260624000000_retirement_planner.sql` exists and correctly establishes the backend tables (`households`, `accounts`, `spendings`, `pensions`, `life_events`, `simulation_configs`, `simulation_results_summaries`), strict RLS policies (`auth.uid() = user_id`), and the Premium tier trigger (`tr_simulation_configs_premium_guard` calling `check_premium_simulation_range`).

---

## 2. Logic Chain
1. **`run_e2e.ts` Docker Conflict**: The E2E test runner `e2e/run_e2e.ts` attempts to stop Supabase and remove containers using `docker ps -aq | xargs -r docker rm -f`. However, if lingering containers exist or `xargs -r` fails to clean up named containers like `supabase_db_expense-dashboard`, `npx supabase start` fails due to container name conflicts. This blocks the entire Playwright test suite from running.
2. **Missing Frontend & State Layer**: `PROJECT.md` defines the UI & State Layer as `src/app/calculator`, `src/SimulationProvider.tsx`, `src/components/QuickCheckWidget.tsx`, and `useRetirementStore.tsx`. While `src/app/calculator` and `src/SimulationProvider.tsx` exist, `QuickCheckWidget.tsx` and `useRetirementStore.tsx` are missing. Without `useRetirementStore.tsx`, there is no mechanism to synchronize state between the QuickCheckWidget and the Full Calculator views.
3. **Missing Server Actions & BOLA/Premium Enforcement**: `PROJECT.md` defines the Backend & Auth contract as `src/actions/retirementActions.ts` with `saveSimulationConfig(config: SimulationConfig)`. This file is missing. Although the database migration (`20260624000000_retirement_planner.sql`) enforces RLS and Premium checks at the Postgres level, the frontend lacks the Server Actions to interact with these tables and handle BOLA defense (`auth.uid() === config.userId`) and Premium entitlement checks (`profiles.tier === 'premium'`) at the Next.js API layer.
4. **Missing Tier 3 Playwright Tests**: `SCOPE.md` requires `e2e/run_e2e.ts` to execute 8 Tier 3 test cases covering pairwise feature interactions (e.g., QuickCheckWidget + Full Calculator state, Scrambled Monte Carlo + BOLA defense, drawdown engine + Premium entitlement checks). Because no Playwright spec file exists for these 8 test cases, M5.3 cannot be verified even if `run_e2e.ts` executes successfully.

---

## 3. Caveats
- **Read-Only Investigation**: As an explorer agent, no code changes or file creations were performed in `src/`, `supabase/`, or `e2e/`. All findings are based on direct observation of the current filesystem and test execution logs.
- **Playwright Execution Blocked**: Because `e2e/run_e2e.ts` failed during the `npx supabase start` setup phase, the Playwright test runner did not execute the existing spec files. However, static analysis confirmed that none of the existing spec files contain the Tier 3 retirement calculator test cases.

---

## 4. Conclusion
Milestone 5.3 (`Tier 3 E2E Test Pass - Cross-Feature Combinations`) is currently failing due to a Docker container conflict in `e2e/run_e2e.ts` and the complete absence of the Tier 3 feature components (`QuickCheckWidget.tsx`, `useRetirementStore.tsx`, `retirementActions.ts`) and E2E test suite (`tier3_cross_feature.spec.ts`).

### Recommended Fix Strategy (Actionable & Scoped)
To achieve 100% passing tests for M5.3, the implementer should execute the following 5-step strategy:
1. **Robustify `e2e/run_e2e.ts` Container Cleanup**: Modify `e2e/run_e2e.ts` to explicitly remove the conflicting Supabase container before starting:
   ```javascript
   try { execSync('docker rm -f supabase_db_expense-dashboard 2>/dev/null || true', { stdio: 'inherit' }); } catch(e){}
   ```
2. **Implement `src/store/useRetirementStore.tsx`**: Create the Zustand store to manage and synchronize simulation configuration and results between the QuickCheckWidget and Full Calculator views.
3. **Implement `src/components/QuickCheckWidget.tsx`**: Create the QuickCheckWidget component, integrating it with `useRetirementStore` and `src/workers/simulation.worker.ts`.
4. **Implement `src/app/actions/retirementActions.ts`**: Create the Supabase Server Actions (`saveSimulationConfig`), implementing explicit BOLA defense (`auth.uid() === config.userId`) and Premium entitlement checks (`profiles.tier === 'premium'`).
5. **Create `e2e/tier3_cross_feature.spec.ts`**: Implement the 8 Tier 3 Playwright test cases covering pairwise feature interactions:
   - *Test 1*: `QuickCheckWidget` interacting with `Full Calculator state` (syncing via `useRetirementStore`).
   - *Test 2*: `Scrambled Monte Carlo` interacting with `BOLA defense` (attempting to save Monte Carlo config with mismatched user ID).
   - *Test 3*: `Drawdown engine` interacting with `Premium entitlement checks` (attempting 125-year historical range drawdown without Premium tier).
   - *Test 4*: `QuickCheckWidget` interacting with `Scrambled Monte Carlo` mode.
   - *Test 5*: `QuickCheckWidget` interacting with `Premium entitlement checks`.
   - *Test 6*: `Full Calculator state` interacting with `BOLA defense`.
   - *Test 7*: `Full Calculator state` interacting with `Premium entitlement checks`.
   - *Test 8*: `Drawdown engine` interacting with `Scrambled Monte Carlo` mode.

---

## 5. Verification Method
To independently verify the fix and confirm Milestone 5.3 completion, execute the following commands:

1. **Verify Tier 2 Verification Scripts**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsx e2e/verify_accumulation.ts
   npx tsx e2e/verify_monte_carlo.ts
   ```
   *Expected Output*: Both scripts complete with exit code 0 (`=== [E2E VERIFICATION] Accumulation Verification PASSED ===` and `=== [E2E VERIFICATION] Monte Carlo Verification PASSED ===`).

2. **Verify Full E2E Test Harness (Including Tier 3 Tests)**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsx e2e/run_e2e.ts
   ```
   *Expected Output*: Supabase starts successfully without container conflicts, Next.js builds successfully, and Playwright executes all test suites (including `tier3_cross_feature.spec.ts`) with 100% passing tests and exit code 0.
