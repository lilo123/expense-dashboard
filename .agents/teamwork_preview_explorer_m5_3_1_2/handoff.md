# Handoff Report — M5.3 Tier 3 E2E Test Pass (Cross-Feature Combinations)

## 1. Observation
During our read-only investigation of the codebase for Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations), we directly observed the following facts and evidence:

- **Missing UI & State Layer Files**: `PROJECT.md` (lines 7-8) defines the UI & State Layer architecture as `src/app/calculator`, `src/SimulationProvider.tsx`, `src/components/QuickCheckWidget.tsx`, `useRetirementStore.tsx`. However, listing `src/components/` and `src/store/` confirmed that `src/components/QuickCheckWidget.tsx` and `src/store/useRetirementStore.tsx` do not exist in the codebase.
- **Missing Backend Actions & BOLA/Premium Checks**: `PROJECT.md` (lines 28-31) defines the contract between `src/app/calculator/page.tsx` ↔ `src/actions/retirementActions.ts` for `saveSimulationConfig(config: SimulationConfig)`, requiring BOLA defense (`auth.uid() === config.userId`) and Premium entitlement checks (`profiles.tier === 'premium'`). Listing `src/app/actions/` confirmed that `retirementActions.ts` does not exist. Furthermore, inspecting `src/app/calculator/CalculatorParams.tsx` confirmed it does not import or call `saveSimulationConfig`.
- **Missing QUICK_CHECK Worker Contract**: `PROJECT.md` (lines 24-26) defines the Web Worker contract `src/workers/simulation.worker.ts` ↔ `src/SimulationProvider.tsx` using request `{ type: 'RUN_SIMULATION' | 'QUICK_CHECK', config: SimulationConfig | QuickCheckParams, runId: string }`. Inspecting `src/workers/simulation.worker.ts` (lines 188-789) confirmed it only exports `simulationService` with `runSimulation(config: SimulationConfig)` via Comlink, completely omitting `QUICK_CHECK` or `quickCheck`.
- **Missing 8 Tier 3 E2E Test Cases**: `SCOPE.md` (lines 3-5) and `TEST_READY.md` (lines 12-13) require passing 8 Tier 3 test cases covering pairwise feature interactions (e.g., QuickCheckWidget interacting with Full Calculator state, Scrambled Monte Carlo interacting with BOLA defense, drawdown engine interacting with Premium entitlement checks). Listing `e2e/` and searching all files for `QuickCheck`, `Premium`, `BOLA`, `pairwise`, and `interaction` confirmed that no E2E test file implements these 8 Tier 3 test cases. Existing verification scripts (`verify_accumulation.ts`, `verify_monte_carlo.ts`, `verify_global_market_data.ts`) only cover Tier 2 boundary and corner cases.
- **Supabase Database Trigger Established**: Inspecting `supabase/migrations/20260624000000_retirement_planner.sql` (lines 141-161) confirmed that the Premium tier guard trigger `tr_simulation_configs_premium_guard` and function `public.check_premium_simulation_range()` are correctly implemented in the database schema.
- **Supabase Docker Startup Flakiness**: Executing `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts ...` produced repeated background task errors during Supabase initialization: `supabase_db_expense-dashboard container is not ready: starting` and `Supabase start attempt 2 failed. Checking status and cleaning up before retry...`.

## 2. Logic Chain
1. **UI & State Interaction Failure**: Because `src/components/QuickCheckWidget.tsx` and `src/store/useRetirementStore.tsx` are absent, there is no dual-entry UI or shared Zustand store. Consequently, the Tier 3 test case for "QuickCheckWidget interacting with Full Calculator state" cannot be executed or passed.
2. **Web Worker Contract Mismatch**: Because `src/workers/simulation.worker.ts` does not implement `QUICK_CHECK`, any future implementation of `QuickCheckWidget` attempting to adhere to the `PROJECT.md` contract will fail to communicate with the Web Worker.
3. **Backend Security & Entitlement Gaps**: Because `src/app/actions/retirementActions.ts` is absent and `CalculatorParams.tsx` lacks saving logic, there is no application-level enforcement of BOLA defense (`auth.uid() === config.userId`) or Premium entitlement checks (`profiles.tier === 'premium'`) when saving configs. Consequently, the Tier 3 test cases for "Scrambled Monte Carlo interacting with BOLA defense" and "drawdown engine interacting with Premium entitlement checks" cannot be executed or passed.
4. **Missing Test Harness Coverage**: Because the 8 Tier 3 pairwise feature interaction test cases are not authored in `e2e/`, the test runner cannot verify M5.3 compliance, leaving a 100% gap in Tier 3 E2E test execution.
5. **E2E Runner Instability**: Because `e2e/run_e2e.ts` experiences timeout failures when starting Supabase containers in Docker, the E2E test suite cannot reliably reach the Playwright execution phase without addressing container readiness timeouts.

## 3. Caveats
- **Read-Only Investigation**: As per our archetype constraints, we did not modify any source code, create missing files, or alter `e2e/run_e2e.ts`.
- **Local Docker Environment**: The Supabase container startup failures observed in `e2e/run_e2e.ts` may be exacerbated by nested containerization or resource constraints in the agent execution environment.
- **No Caveats on Codebase State**: The absence of `QuickCheckWidget.tsx`, `useRetirementStore.tsx`, `retirementActions.ts`, and the 8 Tier 3 test cases is unambiguous and verified across the entire filesystem.

## 4. Conclusion
Milestone 5.3 (Tier 3 E2E Test Pass - Cross-Feature Combinations) is currently blocked by significant architectural gaps in the UI, state management, Web Worker contracts, server actions, and E2E test scripts. 

### Recommended Fix Strategy (Actionable & Scoped)
1. **Implement Backend Server Actions (`src/app/actions/retirementActions.ts`)**:
   - Create `saveSimulationConfig(config: SimulationConfig)`.
   - Enforce BOLA defense: verify `auth.uid() === config.userId`.
   - Enforce Premium entitlement checks: verify `profiles.tier === 'premium'` before allowing users to save advanced configurations (e.g., 125-year range or custom guardrails).
2. **Implement State & UI Components (`src/store/useRetirementStore.tsx` & `src/components/QuickCheckWidget.tsx`)**:
   - Create `useRetirementStore.tsx` using Zustand to synchronize `QuickCheckParams` and `SimulationConfig` between the widget and the full calculator.
   - Create `QuickCheckWidget.tsx` to provide a lightweight input card that dispatches quick check simulations and reflects updates in the main calculator view.
3. **Update Web Worker (`src/workers/simulation.worker.ts`)**:
   - Add `quickCheck(params: QuickCheckParams): SimulationResultsSummary` to `simulationService` to fulfill the `PROJECT.md` worker contract.
4. **Author 8 Tier 3 E2E Test Cases (`e2e/calculator_tier3.spec.ts` or `e2e/verify_tier3_interactions.ts`)**:
   - Implement the 8 pairwise interaction tests required by `SCOPE.md`:
     1. `QuickCheckWidget + Full Calculator State`
     2. `Scrambled Monte Carlo + BOLA Defense`
     3. `Drawdown Engine + Premium Entitlement Checks`
     4. `Global Market Data + Accumulation Phase`
     5. `Scrambled Monte Carlo + Accumulation Phase`
     6. `QuickCheckWidget + Scrambled Monte Carlo`
     7. `Drawdown Engine + Global Market Data`
     8. `Full Calculator State + Premium Entitlement Checks`
5. **Stabilize E2E Test Runner (`e2e/run_e2e.ts`)**:
   - Increase the `sleep` duration or retry threshold following `npx supabase start` to ensure robust database initialization before launching Playwright.

## 5. Verification Method
To independently verify the findings and the success of future implementations:
1. **Inspect Filesystem**: Verify the existence and implementation of:
   - `src/components/QuickCheckWidget.tsx`
   - `src/store/useRetirementStore.tsx`
   - `src/app/actions/retirementActions.ts`
   - `e2e/calculator_tier3.spec.ts` (or `e2e/verify_tier3_interactions.ts`)
2. **Execute E2E Test Runner**: Run the full verification suite defined in `TEST_READY.md` and `SCOPE.md`:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts
   ```
3. **Expected Outcome**: All tests must pass with exit code 0, zero TypeScript errors, and a flawless CLEAN audit verdict.
