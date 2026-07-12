# Handoff Report: Investigation of Division-by-Zero / `NaN` Propagation Vulnerability in Simulation Worker (Explorer 2 iter2)

## 1. Observation
- **Background & Context**: Reviewed `PROJECT.md`, `.agents/sub_orch_m4_1/SCOPE.md`, `.agents/ORIGINAL_REQUEST.md`, and Challenger 2 gen1's report (`.agents/teamwork_preview_challenger_m4_1_2_gen1/handoff.md`).
- **Verbatim Error Investigated**: Challenger 2 gen1's adversarial stress test harness (`e2e/stress_test_m4_edge_cases.ts`) failed with:
  ```
  [STRESS TEST EXCEPTION] Strategy endowment (Zero Portfolio & Zero Withdrawal) threw error: Cannot read properties of undefined (reading 'count')
  ```
- **Codebase Inspection (`src/workers/simulation.worker.ts`)**:
  - **Lines 83-84 (`guyton_klinger` strategy)**:
    ```typescript
    const gkInitial = config.gkInitialWithdrawal !== undefined ? config.gkInitialWithdrawal : 40000;
    const gkInitialRate = gkInitial / initialPortfolio;
    ```
  - **Lines 129-131 (`endowment` strategy)**:
    ```typescript
    const prevRatio = config.endowmentPreviousWithdrawalRatio !== undefined ? config.endowmentPreviousWithdrawalRatio / 100 : 0.7;
    const portRatio = config.endowmentPercentOfPortfolio !== undefined ? config.endowmentPercentOfPortfolio / 100 : 0.3;
    const baseEndowRate = annualWithdrawal / initialPortfolio;
    ```
  - **Lines 676-681 (Histogram Binning for `realEndingBalance`)**:
    ```typescript
    for (const run of runs) {
      let binIdx = Math.floor((run.realEndingBalance - minVal) / binSize);
      if (binIdx >= binCount) binIdx = binCount - 1;
      if (binIdx < 0) binIdx = 0;
      defaultHistogramBins[binIdx].count++;
      defaultHistogramBins[binIdx].startYears.push(run.startYear);
    }
    ```

## 2. Logic Chain
1. **Unchecked Division by Zero**: In `src/workers/simulation.worker.ts` line 131 (`endowment`), `baseEndowRate` is calculated as `annualWithdrawal / initialPortfolio`. When `initialPortfolio === 0` and `annualWithdrawal === 0` (the Zero Portfolio & Zero Withdrawal edge case), this evaluates to `0 / 0`, producing `NaN`. (Similarly, in `guyton_klinger` at line 84, `gkInitial / initialPortfolio` produces `NaN` or `Infinity`).
2. **`NaN` Propagation to Balance**: In `endowment`, the first year withdrawal is calculated as `withdrawal = currentBalance * baseEndowRate`, which evaluates to `0 * NaN = NaN`. This corrupts `currentBalance` (`currentBalance -= NaN` becomes `NaN`) and propagates `NaN` across all subsequent simulated years, ultimately resulting in `run.realEndingBalance = NaN`.
3. **Failure of Bin Index Clamping**: During histogram binning at line 676, `binIdx = Math.floor((NaN - minVal) / binSize)` evaluates to `NaN`. The subsequent boundary checks (`binIdx >= binCount` and `binIdx < 0`) both evaluate to `false` because any relational comparison with `NaN` returns `false`. Consequently, `binIdx` is neither clamped to `binCount - 1` nor `0`, remaining `NaN`.
4. **Fatal Crash on Property Access**: At line 681, `defaultHistogramBins[NaN]` returns `undefined`. Attempting to increment `.count` on `undefined` (`defaultHistogramBins[binIdx].count++`) throws the fatal exception `Cannot read properties of undefined (reading 'count')`, crashing the Web Worker.

## 3. Caveats
- **Read-Only Constraint**: As per the `Read-only investigation — do NOT implement` constraint, no modifications were made to `src/workers/simulation.worker.ts`. The findings and exact recommended changes are documented here for the implementer.
- **Local Execution**: All investigations were conducted locally with zero git push, adhering strictly to project guardrails.

## 4. Conclusion
- **Verdict**: The simulation engine contains a fatal division-by-zero and `NaN` propagation vulnerability in `src/workers/simulation.worker.ts` under the `endowment` and `guyton_klinger` strategies when `initialPortfolio === 0`, leading to an unclamped `NaN` bin index during histogram generation.
- **Recommended Fix Strategy**:
  1. **Add `initialPortfolio > 0` Guardrails**:
     - **Line 84 (`guyton_klinger`)**: Update to `const gkInitialRate = initialPortfolio > 0 ? gkInitial / initialPortfolio : 0;`
     - **Line 131 (`endowment`)**: Update to `const baseEndowRate = initialPortfolio > 0 ? annualWithdrawal / initialPortfolio : 0;`
  2. **Add `Number.isNaN(binIdx)` Guardrail**:
     - **Lines 676-680 (Histogram Binning)**: Update to:
       ```typescript
       let binIdx = Math.floor((run.realEndingBalance - minVal) / binSize);
       if (Number.isNaN(binIdx)) binIdx = 0;
       if (binIdx >= binCount) binIdx = binCount - 1;
       if (binIdx < 0) binIdx = 0;
       ```

## 5. Verification Method
To independently verify the fix once implemented, execute the following commands from the root working directory (`/usr/local/google/home/duynguyenn/expense-dashboard`):
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
# 1. Verify baseline happy-path passes
npx tsc --noEmit
npm run test
npm run build
npx tsx e2e/verify_accumulation.ts
npx tsx e2e/verify_monte_carlo.ts

# 2. Verify stress test passes successfully without throwing the endowment NaN crash
npx tsx e2e/stress_test_m4_edge_cases.ts
```
