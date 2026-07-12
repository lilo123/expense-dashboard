# M5.2 Tier 2 E2E Test Pass (Boundary & Corner Cases) - Investigation & Handoff Report

## 1. Observation
- **Test Runner Execution & Logs (`task-20.log`)**:
  - Executed `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_accumulation.ts; npx tsx e2e/verify_monte_carlo.ts; npx tsx e2e/run_e2e.ts`.
  - `verify_accumulation.ts` passed with exit code 0 but logged several warnings: `[WARN] Run startYear 1910, Age 20: endBalance ($931531.16) not greater than startBalance ($1005866.61) despite contributions.`
  - `verify_monte_carlo.ts` passed with exit code 0, confirming 1,000 runs and 100% determinism.
  - `run_e2e.ts` initiated the database setup and Next.js build, emitting `⚠ Invalid next.config.js options detected: Unrecognized key(s) in object: 'outputFileTracing'`.
- **Codebase & E2E Test Structure**:
  - `TEST_READY.md` defines the test runner command as: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts && exec npx tsx e2e/run_e2e.ts`.
  - `sub_orch_m5_1_2/SCOPE.md` defines it as: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts`.
  - `e2e/verify_accumulation.ts` exists for F2 (Accumulation Phase & Timeline Toggle).
  - `e2e/verify_monte_carlo.ts` exists for F3 (Simulation Mode Toggle - Monte Carlo).
  - **There is NO standalone verification script for F1 (Global Market Data Toggle) such as `e2e/verify_global_market_data.ts` in `e2e/` or in the test runner command.**
  - `e2e/stress_test_m4.ts` and `e2e/stress_test_m4_edge_cases.ts` contain extensive boundary, Zod schema refinement, differential testing, and extreme edge case assertions covering F1, F2, and F3, but are NOT executed by `run_e2e.ts` or the `TEST_READY.md` command string.
- **Semantic Flaw in `e2e/verify_accumulation.ts`**:
  - `e2e/verify_accumulation.ts` (line 20) specifies `duration: 50, // 20 years accumulation (40-59) + 30 years retirement (60-89)`.
  - `src/workers/simulation.worker.ts` (lines 195-199) treats `config.duration` as `retirementYears` and calculates `totalDuration = accumulationYears + retirementYears`.
  - Consequently, `verify_accumulation.ts` inadvertently runs a 70-year simulation (`20 + 50 = 70`) instead of the intended 50-year simulation (`20 + 30 = 50`).

## 2. Logic Chain
1. **Identification of the 15 Tier 2 Boundary & Corner Case Tests**:
   To satisfy M5.2 requirements (15 tests total, 5 per feature across F1, F2, F3 covering edge cases, Zod refinements, and PRNG boundaries), the test suite must explicitly verify the following:
   - **F1: Global Market Data Toggle (5 Tests)**:
     1. *Zod Schema Validation & Defaulting*: Verify `marketDataMode` defaults to `'us'` when omitted, accepts `'global'`, and rejects invalid strings (e.g., `'uk'`, `'eu'`).
     2. *Global Market Data Date Boundaries*: Verify `getValidStartYears(duration, 'global')` correctly restricts start years to `1970` (since MSCI data starts Dec 1969) up to `2025 - duration + 1`, whereas US mode starts at `1871`.
     3. *Out-of-Bounds Year Fallback*: Verify `getMarketDataForYear(year, 'global')` correctly returns the fallback proxy data (`startCpi: 322.0`, `endCpi: 329.0`, `cape: 25.0`, `stockMarketGrowth: 0.07`) when queried for an out-of-bounds year (e.g., `1871` in global mode, or `2050`).
     4. *MSCI vs Shiller Proxy Merging Integrity*: Verify `createGlobalMarketData` correctly calculates `stockMarketGrowth` from `msciWorldDecemberValues` while successfully merging proxy metrics (`startCpi`, `endCpi`, `cape`, `dividendYields`, `bondsGrowth`) from Shiller data without NaN/undefined values.
     5. *Simulation Execution under Global Mode*: Verify `simulationService.runSimulation` executes successfully using `marketDataMode: 'global'` across extreme durations and withdrawal strategies without throwing errors or producing NaN in columnar buffers.
   - **F2: Accumulation Phase & Timeline Toggle (5 Tests)**:
     1. *Zod Schema Refinement*: Verify `timelineMode: 'retirement_and_accumulation'` rejects configurations where `currentAge > retirementAge`, or where `currentAge` / `retirementAge` are missing.
     2. *Zero Accumulation Window Boundary*: Verify `currentAge === retirementAge` (0 accumulation years) is accepted by Zod and correctly handled by `simulationService.runSimulation` (immediately starts retirement phase in Year 1).
     3. *Negative/Invalid Age Fuzzing*: Verify Zod schema rejects negative ages (`-1`), extreme ages (`> 150`), and invalid contributions (`< 0` or `> 10,000,000`).
     4. *Differential Testing (Ignored Inputs)*: Verify `additionalContribution`, `currentAge`, and `retirementAge` are completely ignored when `timelineMode === 'retirement_only'`, producing identical simulation results to a baseline config.
     5. *Accumulation Cash Flow & Compounding Integrity*: Verify that during accumulation years (Years 1 to `retirementAge - currentAge`), `withdrawal` and `realWithdrawal` are exactly `$0`, `additionalContribution` is added, and portfolio growth compounds correctly (`endBalance > startBalance`).
   - **F3: Simulation Mode Toggle (Monte Carlo) (5 Tests)**:
     1. *Zod Schema & Mode Defaults*: Verify `simulationMode` defaults to `'historical'`, accepts `'monte_carlo'`, and rejects invalid modes.
     2. *PRNG Determinism & Reproducibility*: Verify Mulberry32 PRNG produces 100% deterministic and reproducible simulation summaries (`successRate`, `medianEndingBalance`, and individual run ending balances) across multiple invocations with identical configs.
     3. *Exact Run Count Boundary*: Verify Monte Carlo mode always generates exactly 1,000 simulation runs (`totalRuns === 1000`), regardless of the `startYearMin`/`startYearMax` filters (which only apply to historical mode).
     4. *Extreme Timeline Stress & Memory Handling*: Verify Monte Carlo mode successfully executes 1,000 runs with maximum combined duration (e.g., 125 years: 60 yrs accumulation + 65 yrs retirement) within performance budgets (< 5000ms) without memory overflow.
     5. *Zero-Copy Columnar Buffer Integrity*: Verify `balancesBuffer`, `withdrawalsBuffer`, and `growthBuffer` (Float64Array) are correctly sized (`1000 * totalDuration`) and contain no `NaN` or `Infinity` values across all 1,000 runs.

2. **Gaps & Needed Adjustments**:
   - Because `e2e/verify_global_market_data.ts` does not exist, F1 lacks dedicated E2E verification in the `TEST_READY.md` execution chain.
   - Because `e2e/verify_accumulation.ts` passes `duration: 50`, it incorrectly simulates 50 years of retirement instead of 30, creating a semantic gap between the test intent and worker execution.
   - Because `e2e/stress_test_m4.ts` and `e2e/stress_test_m4_edge_cases.ts` are excluded from `TEST_READY.md`, several Tier 2 boundary tests are not actively enforced during E2E runs.

## 3. Caveats
- The investigation is read-only; no code changes were implemented.
- `verify_accumulation.ts` logs warnings regarding `endBalance` not exceeding `startBalance` in certain historical years (e.g., 1910–1912, 1929–1931). This is expected behavior during severe historical market crashes (e.g., Great Depression) where market losses exceed the additional contributions, but the test correctly passes because withdrawals remain $0.

## 4. Conclusion
To achieve 100% flawless execution of the 15 Tier 2 boundary & corner case tests for M5.2, the Worker must execute the following concrete fix strategy:
1. **Create `e2e/verify_global_market_data.ts`**: Implement the 5 Tier 2 boundary & corner case tests for F1 (Global Market Data Toggle) covering Zod validation, start year boundaries (`1970` vs `1871`), out-of-bounds fallbacks, MSCI/Shiller proxy merging integrity, and simulation execution under global mode.
2. **Fix `e2e/verify_accumulation.ts`**: Update `duration: 50` to `duration: 30` so that `totalDuration` correctly equals `50` (`20` accumulation + `30` retirement). Ensure the 5 Tier 2 tests for F2 are fully asserted.
3. **Enhance `e2e/verify_monte_carlo.ts`**: Ensure the 5 Tier 2 tests for F3 (including Zod defaults, PRNG determinism, exact 1,000 run count, 125-year extreme timeline stress, and zero-copy columnar buffer integrity) are fully asserted.
4. **Update `TEST_READY.md` and `sub_orch_m5_1_2/SCOPE.md`**: Add `npx tsx e2e/verify_global_market_data.ts` to the master test runner command string.
5. **Clean up `next.config.js`**: Remove the unrecognized `outputFileTracing` key to eliminate build warnings.

## 5. Verification Method
The Worker and Reviewer can independently verify the fixes by executing:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
npx tsx e2e/verify_global_market_data.ts
npx tsx e2e/verify_accumulation.ts
npx tsx e2e/verify_monte_carlo.ts
npx tsx e2e/run_e2e.ts
```
**Expected Outcome**: All scripts must execute successfully and terminate with exit code 0, verifying all 15 Tier 2 boundary & corner case tests with zero failures or warnings.
