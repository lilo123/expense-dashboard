# M5.3 Tier 3 E2E Test Pass (Cross-Feature Combinations) — Exploration & Handoff Report

## 1. Observation
During our read-only investigation of the codebase for Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations), we observed the following facts and verified evidence chains:

- **PROJECT.md & SCOPE.md Contracts**:
  - `PROJECT.md` defines `src/components/QuickCheckWidget.tsx`, `useRetirementStore.tsx`, and `src/actions/retirementActions.ts` (with `saveSimulationConfig` enforcing BOLA defense and Premium entitlement checks) as core architectural components.
  - `PROJECT.md` defines the Web Worker contract as expecting `{ type: 'RUN_SIMULATION' | 'QUICK_CHECK', config: SimulationConfig | QuickCheckParams, runId: string }`.
  - `SCOPE.md` requires passing 8 Tier 3 test cases covering pairwise feature interactions (e.g., QuickCheckWidget interacting with Full Calculator state, Scrambled Monte Carlo interacting with BOLA defense, drawdown engine interacting with Premium entitlement checks).
- **Codebase Verification (Missing Assets)**:
  - `list_dir` on `src/components`, `src/store`, `src/app/actions`, and `src/` confirmed that `QuickCheckWidget.tsx`, `useRetirementStore.tsx`, and `retirementActions.ts` do NOT exist anywhere in the codebase. `code_search` for `saveSimulationConfig` yielded 0 matches in the project.
  - `view_file` on `src/app/calculator/CalculatorParams.tsx` confirmed it contains no imports or wiring for `QuickCheckWidget`, `useRetirementStore`, or `saveSimulationConfig`.
  - `view_file` on `src/workers/simulation.worker.ts` confirmed it exposes `simulationService = { runSimulation(config: SimulationConfig): SimulationSummary }` via Comlink but lacks `QUICK_CHECK` support or the `{ type: ... }` wrapper contract.
- **E2E Test Suite Verification**:
  - `list_dir` on `e2e/` and `view_file` on existing test scripts confirmed there is no test file implementing the 8 Tier 3 pairwise feature interaction test cases. `verify_accumulation.ts` and `verify_monte_carlo.ts` explicitly test Tier 2 Boundary & Corner Cases.
  - `run_command` executing `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts` failed with exit code 1 (`task-14`). The failure log showed a Docker conflict: `failed to create docker container: Error response from daemon: Conflict. The container name "/supabase_db_expense-dashboard" is already in use by container...`.

## 2. Logic Chain
1. **QuickCheckWidget & Store Absence**: Because `QuickCheckWidget.tsx` and `useRetirementStore.tsx` are missing, any Tier 3 test attempting to verify pairwise interactions between `QuickCheckWidget` and Full Calculator state will fail or cannot be written.
2. **RetirementActions & Security Check Absence**: Because `retirementActions.ts` is missing, the Server Actions required to test BOLA defense (`auth.uid() === config.userId`) and Premium entitlement checks (`profiles.tier === 'premium'`) during simulation config saving do not exist.
3. **Web Worker Incompatibility**: Because `simulation.worker.ts` only implements `runSimulation` via Comlink, it cannot handle `QUICK_CHECK` requests from the planned `QuickCheckWidget`.
4. **Missing Tier 3 Test Harness**: Because no script or Playwright spec in `e2e/` contains the 8 Tier 3 pairwise test cases, M5.3 cannot be verified or completed until these tests are authored.
5. **Docker Cleanup Flaw in `run_e2e.ts`**: Because `run_e2e.ts` relies on `npx supabase stop` and generic `docker ps -aq` filters which fail to remove stuck containers by name, subsequent test runs collide with existing container names like `supabase_db_expense-dashboard`.

## 3. Caveats
- **Read-Only Investigation**: As an explorer agent, no code changes or file creations were performed in `src/` or `e2e/`. All findings are based on static analysis, directory listings, file viewing, and test runner execution logs.
- **Supabase Local State**: The Docker container conflict in `run_e2e.ts` prevented the Playwright test runner from launching in our background task, but static analysis of the `e2e/` directory conclusively proved the absence of the Tier 3 test cases regardless of Docker health.

## 4. Conclusion
The codebase is currently not ready to pass Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations) due to missing frontend components (`QuickCheckWidget`), missing state stores (`useRetirementStore`), missing backend Server Actions (`retirementActions.ts`), a Web Worker contract mismatch, and the complete absence of the Tier 3 E2E test suite.

### Recommended Fix Strategy (To be executed by Implementer):
1. **Create `src/store/useRetirementStore.tsx`**: Implement Zustand store for sharing simulation state between widget and full calculator.
2. **Create `src/components/QuickCheckWidget.tsx`**: Implement the dual-entry quick check UI widget and integrate it into `src/app/calculator/CalculatorParams.tsx`.
3. **Create `src/app/actions/retirementActions.ts`**: Implement `saveSimulationConfig(config: SimulationConfig)` with strict BOLA validation (`user.id === config.userId`) and Premium entitlement checks (`profiles.tier === 'premium'`).
4. **Update `src/workers/simulation.worker.ts`**: Add support for `QUICK_CHECK` / `quickCheck(params: QuickCheckParams)` to satisfy the `PROJECT.md` contract.
5. **Author Tier 3 Test Suite (`e2e/verify_tier3_interactions.ts` & `e2e/tier3_pairwise.spec.ts`)**: Implement the 8 Tier 3 pairwise feature interaction test cases as defined in `SCOPE.md`.
6. **Fix `e2e/run_e2e.ts` Docker Cleanup**: Add explicit `docker rm -f supabase_db_expense-dashboard supabase_kong_expense-dashboard supabase_auth_expense-dashboard supabase_rest_expense-dashboard supabase_realtime_expense-dashboard supabase_storage_expense-dashboard 2>/dev/null || true` to `setup()` and `cleanup()`.

## 5. Verification Method
To independently verify the findings and eventual fixes:
1. Inspect `src/components/QuickCheckWidget.tsx`, `src/store/useRetirementStore.tsx`, `src/app/actions/retirementActions.ts`, and `e2e/verify_tier3_interactions.ts` to ensure they exist and match `PROJECT.md` contracts.
2. Run the E2E test runner command:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && npx tsx e2e/verify_tier3_interactions.ts
   ```
3. Verify all tests pass with exit code 0 and zero TypeScript errors.
