# Handoff Report: M4 UI Inputs & Toggles Verification & Stress Testing (Challenger 2 gen1)

## 1. Observation
- **Baseline Verification Commands**: Executed `npx tsc --noEmit`, `npm run test`, `npm run build`, `npx tsx e2e/verify_accumulation.ts`, `npx tsx e2e/verify_monte_carlo.ts`, and `npx tsx e2e/run_e2e.ts`. All baseline checks and Playwright E2E tests completed successfully with 100% passing test suites.
- **Stress Testing Harness (`e2e/stress_test_m4_edge_cases.ts`)**: Created and executed an adversarial stress testing harness covering market data integrity, differential testing between timeline modes, and extreme boundary/edge cases across all 13 withdrawal strategies.
- **Verbatim Error Observed**:
  ```
  === [STRESS TESTING HARNESS] M4 UI Inputs & Toggles Edge Cases ===

  --- 1. Verifying Market Data Integrity (US & Global) ---
  ✔ Market data integrity verified successfully.

  --- 2. Differential Testing: Timeline Modes & Ignored Inputs ---
  ✔ Differential testing passed successfully.

  --- 3. Extreme Boundary & Edge Case Testing (All 13 Strategies) ---
  [STRESS TEST EXCEPTION] Strategy endowment (Zero Portfolio & Zero Withdrawal) threw error: Cannot read properties of undefined (reading 'count')
  ✔ Extreme boundary & edge case testing completed.

  === [STRESS TESTING HARNESS] FAILED ===
  ```
- **Codebase Inspection (`src/workers/simulation.worker.ts`)**:
  - **Line 131**: `const baseEndowRate = annualWithdrawal / initialPortfolio;`
  - **Line 678**: `let binIdx = Math.floor((run.realEndingBalance - minVal) / binSize);`
  - **Lines 679-680**: `if (binIdx >= binCount) binIdx = binCount - 1; if (binIdx < 0) binIdx = 0;`
  - **Line 681**: `defaultHistogramBins[binIdx].count++;`

## 2. Logic Chain
1. **Baseline Correctness Verified**: The successful execution of `tsc`, `test`, `build`, `verify_accumulation`, `verify_monte_carlo`, and `run_e2e` confirms that Worker 1's M4 implementation meets the happy-path acceptance criteria and introduces zero regressions in the existing test suites.
2. **Root Cause Analysis of Stress Test Failure**:
   - When `initialPortfolio === 0` and `annualWithdrawal === 0` (Zero Portfolio & Zero Withdrawal edge case), `baseEndowRate` in `src/workers/simulation.worker.ts:131` evaluates to `0 / 0`, which produces `NaN`.
   - Consequently, `withdrawal = currentBalance * baseEndowRate` evaluates to `0 * NaN = NaN`, corrupting `currentBalance` and propagating `NaN` to `run.realEndingBalance`.
   - During histogram binning (`src/workers/simulation.worker.ts:678`), `binIdx = Math.floor((NaN - minVal) / binSize)` evaluates to `NaN`.
   - Because `NaN >= binCount` and `NaN < 0` both evaluate to `false`, `binIdx` is not clamped and remains `NaN`.
   - Finally, `defaultHistogramBins[NaN]` evaluates to `undefined`, causing `defaultHistogramBins[binIdx].count++` to throw the fatal exception `Cannot read properties of undefined (reading 'count')`.
3. **Actionable Flaw Identified**: The simulation engine lacks guardrails against division by zero when `initialPortfolio === 0` in the `endowment` strategy (and potentially `guyton_klinger` where `gkInitialRate = gkInitial / initialPortfolio` produces `Infinity` or `NaN`), as well as missing `NaN` checks during histogram binning.

## 3. Caveats
- As per the `Review-only — do NOT modify implementation code` constraint, the identified bug was not fixed in `src/workers/simulation.worker.ts`. It is documented here as an empirical finding for the implementer to address.
- All work was executed strictly locally with zero git pushes, complying with the BOLA defenses and zero git push guardrails.

## 4. Conclusion
- **Verdict**: Milestone 4 passes all baseline happy-path acceptance criteria but **FAILS** adversarial stress testing due to a division-by-zero / `NaN` propagation vulnerability in `src/workers/simulation.worker.ts` under the `endowment` strategy when `initialPortfolio === 0`.
- **Recommended Fix**: Update `src/workers/simulation.worker.ts` to check `initialPortfolio > 0` before dividing (fallback to `0`), and add a check `if (Number.isNaN(binIdx)) binIdx = 0;` before accessing `defaultHistogramBins`.

## 5. Verification Method
To independently verify these findings, execute the following commands from the root working directory (`/usr/local/google/home/duynguyenn/expense-dashboard`):
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
# 1. Verify baseline happy-path passes
npx tsc --noEmit
npm run test
npm run build
npx tsx e2e/verify_accumulation.ts
npx tsx e2e/verify_monte_carlo.ts

# 2. Verify stress test failure (reproduces the endowment NaN crash)
npx tsx e2e/stress_test_m4_edge_cases.ts
```
