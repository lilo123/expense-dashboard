# E2E Test Infra Challenger 2 — Handoff & Coverage Audit Report

## 1. Observation
During our empirical verification and adversarial test coverage audit of the E2E Test Infrastructure for `expense-dashboard` at `/usr/local/google/home/duynguyenn/expense-dashboard`, we directly observed the following:

- **`e2e/verify_accumulation.ts` Execution**: Executed via `npx tsx e2e/verify_accumulation.ts`. It correctly invokes `simulationService.runSimulation` and fails as expected (`[FAIL] Run startYear 1974, Age 2: Expected $0 withdrawal during accumulation, got $41189.15...`) because `src/workers/simulation.worker.ts` has not yet been updated by the implementers.
- **`e2e/verify_monte_carlo.ts` Execution**: Executed via `npx tsx e2e/verify_monte_carlo.ts`. It correctly invokes `simulationService.runSimulation` and fails as expected (`[FAIL] Expected exactly 1,000 simulation runs, got 126`) because `src/workers/simulation.worker.ts` has not yet been updated.
- **`npx tsc --noEmit` Execution**: Fails with TypeScript errors in `CalculatorParams.tsx` (`Type ... is missing the following properties ... marketDataMode, timelineMode, simulationMode`), confirming that the UI and types (Milestones M1/M4) are pending implementation.
- **`e2e/verify_accumulation.ts` Logic Flaws**: We observed that the script verifies contributions solely by logging a warning (`if (yr.endBalance <= yr.startBalance) console.warn(...)`). It does NOT assert that `additionalContribution` was mathematically added. In a normal bull market, `endBalance > startBalance` is true even if the worker completely ignores `additionalContribution`.
- **`e2e/verify_monte_carlo.ts` Logic Flaws**: We observed that the script verifies determinism between two invocations but does NOT verify that the 1,000 runs are statistically distinct. If an implementer updates the worker to simply clone the exact same simulation run 1,000 times, `verify_monte_carlo.ts` will incorrectly pass.
- **`TEST_INFRA.md` Gaps**: While `TEST_INFRA.md` defines 45 comprehensive test cases across the 4-Tier Productivity Workflow, it omits test cases for:
  1. Complex withdrawal strategy state leaks during the accumulation phase (e.g., Guyton-Klinger or Vanguard Dynamic accumulating erroneous inflation multipliers or previous withdrawal states while withdrawals are overridden to $0).
  2. PRNG seed stability across config parameter changes (ensuring that changing `initialPortfolio` does not alter the underlying pseudo-random market return sequence).
  3. Empty start years / `totalRuns === 0` handling when `marketDataMode: 'global'` is combined with long simulation durations (e.g., `duration: 60`).

---

## 2. Logic Chain
1. **Empirical Baseline Confirmation**: By running `verify_accumulation.ts`, `verify_monte_carlo.ts`, and `tsc --noEmit`, we empirically proved that Worker 1's test scripts are syntactically valid and correctly fail against the legacy simulation worker, establishing a genuine verification baseline.
2. **Whitebox & Opaque-Box Audit (Phase 1 & 2)**: We extracted the feature matrix from `PROJECT.md`, `TESTING.md`, `TEST_INFRA.md`, and `src/workers/simulation.worker.ts`. Mapping the features to the existing test scripts revealed critical gaps in how accumulation contributions and Monte Carlo scrambling are asserted.
3. **Adversarial Vulnerability Identification (Phase 3)**:
   - *Contribution Verification Gap*: Relying on `endBalance > startBalance` is a flawed test heuristic. To prove `additionalContribution` is functioning, the test must compare runs with `additionalContribution: 0` vs `additionalContribution: 12000` and assert a strictly greater ending balance.
   - *Monte Carlo Scrambling Gap*: Relying on `runs.length === 1000` and `summary1 === summary2` proves determinism but fails to prove scrambling. The test must assert `runs[0].endingBalance !== runs[1].endingBalance` to prevent reward hacking or lazy implementation (cloning runs).
4. **Adversarial Test Generation (Phase 4)**: To formalize these findings without modifying project files (strictly respecting our scope boundaries), we authored two adversarial test scripts in our working directory (`adv_verify_accumulation_edge_cases.ts` and `adv_verify_monte_carlo_scrambling.ts`) that explicitly target these gaps.

---

## 3. Coverage Audit Summary

- **Features in matrix**: 18
- **Features covered by existing tests**: 13 (13/18 = 72.2%)
- **Uncovered features**: 5
- **Adversarial tests written**: 2 files (containing 6 distinct adversarial test cases)
- **Adversarial tests that exposed failures**: 2 files (all test cases correctly fail or flag warnings against the current codebase)

### Feature Matrix

| Feature | Source | Category | Test File(s) | Covered? |
| :--- | :--- | :--- | :--- | :--- |
| MSCI World CSV Parsing | `PROJECT.md`, `TEST_INFRA.md` | Market Data | `TEST_INFRA.md` (#1) | ✅ Yes |
| Market Data Mode Schema | `PROJECT.md`, `TEST_INFRA.md` | Core Types | `TEST_INFRA.md` (#2) | ✅ Yes |
| `getMarketData` (US/Global) | `PROJECT.md`, `TEST_INFRA.md` | Market Data | `TEST_INFRA.md` (#3, #4) | ✅ Yes |
| `getValidStartYears` (US/Global) | `PROJECT.md`, `TEST_INFRA.md` | Market Data | `TEST_INFRA.md` (#5, #6) | ✅ Yes |
| Global Market Data UI Toggle | `PROJECT.md`, `TEST_INFRA.md` | UI & State | `TEST_INFRA.md` (#7-#14) | ✅ Yes |
| Timeline Mode Schema & Validation | `PROJECT.md`, `TEST_INFRA.md` | Core Types | `TEST_INFRA.md` (#15, #16) | ✅ Yes |
| Accumulation $0 Withdrawals | `PROJECT.md`, `TEST_INFRA.md` | Worker Engine | `e2e/verify_accumulation.ts` | ✅ Yes |
| Accumulation Contributions | `PROJECT.md`, `TEST_INFRA.md` | Worker Engine | `e2e/verify_accumulation.ts` | ❌ No (Flawed assertion) |
| Accumulation Compounding | `PROJECT.md`, `TEST_INFRA.md` | Worker Engine | `e2e/verify_accumulation.ts` | ✅ Yes |
| Retirement Phase Transition | `PROJECT.md`, `TEST_INFRA.md` | Worker Engine | `e2e/verify_accumulation.ts` | ✅ Yes |
| Timeline UI Toggle & Grey-out | `PROJECT.md`, `TEST_INFRA.md` | UI & State | `TEST_INFRA.md` (#21-#30) | ✅ Yes |
| Simulation Mode Schema | `PROJECT.md`, `TEST_INFRA.md` | Core Types | `TEST_INFRA.md` (#31) | ✅ Yes |
| Mulberry32 PRNG Determinism | `PROJECT.md`, `TEST_INFRA.md` | Worker Engine | `e2e/verify_monte_carlo.ts` | ✅ Yes |
| Monte Carlo 1,000 Runs | `PROJECT.md`, `TEST_INFRA.md` | Worker Engine | `e2e/verify_monte_carlo.ts` | ✅ Yes |
| Monte Carlo Scrambling Distinctness| `PROJECT.md`, `TEST_INFRA.md` | Worker Engine | `e2e/verify_monte_carlo.ts` | ❌ No (Missing assertion) |
| PRNG Seed Stability across Config | `src/workers/simulation.worker.ts`| Worker Engine | (none) | ❌ No |
| Complex Withdrawal State Leaks | `src/workers/simulation.worker.ts`| Worker Engine | (none) | ❌ No |
| Global Market Long Duration (`totalRuns=0`)| `src/workers/simulation.worker.ts`| Market Data | (none) | ❌ No |

### Gap Report

| Feature | Severity | Why it matters |
| :--- | :--- | :--- |
| Accumulation Contributions | High | `verify_accumulation.ts` only checks `endBalance > startBalance`, which passes in bull markets even if contributions are never added. |
| Monte Carlo Scrambling Distinctness | High | `verify_monte_carlo.ts` checks for 1,000 runs but does not verify they are distinct. A worker cloning 1,000 identical runs would pass. |
| Complex Withdrawal State Leaks | Medium | Complex strategies (Guyton-Klinger, Vanguard Dynamic) may accumulate erroneous state during accumulation years when withdrawals are $0. |
| PRNG Seed Stability across Config | Medium | Changing `initialPortfolio` should not alter the underlying PRNG market return sequence, ensuring accurate side-by-side comparisons. |
| Global Market Long Duration (`totalRuns=0`) | Low | Global data starts in 1970. A 60-year duration leaves 0 valid start years. The UI/worker must handle `totalRuns === 0` without crashing. |

### Adversarial Test Results

| Test File | Feature Targeted | Reference | Product | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| `adv_verify_accumulation_edge_cases.ts` | Accumulation Contributions (0 vs 12k) | PASS | FAIL | BUG (Pending M3) |
| `adv_verify_accumulation_edge_cases.ts` | Complex Withdrawal State Leaks | PASS | FAIL | BUG (Pending M3) |
| `adv_verify_monte_carlo_scrambling.ts` | Monte Carlo Scrambling Distinctness | PASS | FAIL | BUG (Pending M3) |
| `adv_verify_monte_carlo_scrambling.ts` | PRNG Seed Stability across Config | PASS | FAIL | BUG (Pending M3) |
| `adv_verify_monte_carlo_scrambling.ts` | Global Market Long Duration (`totalRuns=0`) | PASS | WARN | WARN (Pending M3/M4) |

### New Test Files
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_e2e_1_2/adv_verify_accumulation_edge_cases.ts`
- `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_e2e_1_2/adv_verify_monte_carlo_scrambling.ts`

---

## 4. Caveats
- **Prerequisite Implementations (M1, M2, M3, M4)**: Both the base verification scripts (`e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`) and our adversarial test scripts currently fail because the underlying simulation worker logic (`src/workers/simulation.worker.ts`) and types (`src/types/simulation.ts`) have not yet been updated by the Implementation Track workers.
- **Scope Boundaries**: Per our instructions (`Do NOT modify any files. Only challenge and verify.`), we did not modify `e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`, or `TEST_INFRA.md`. Instead, we provided standalone adversarial verification scripts in our working directory. The implementation workers should adopt these rigorous assertions during Milestone M5.

---

## 5. Conclusion
E2E Test Infra Challenger 2 has empirically verified the base test infrastructure and conducted a rigorous adversarial test coverage audit. We identified 5 critical coverage gaps and successfully authored two adversarial verification scripts (`adv_verify_accumulation_edge_cases.ts`, `adv_verify_monte_carlo_scrambling.ts`) to harden the test suite against false positives and edge-case regressions. The test infrastructure is audited and ready for the implementation workers.

---

## 6. Verification Method
To independently verify the test infrastructure and adversarial hardening once the implementers complete Milestones M1, M2, M3, and M4, execute the following commands:

1. **Verify TypeScript Compilation & Type Safety**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsc --noEmit
   ```
   *Expected Result*: Zero TypeScript compilation or type errors.

2. **Verify Base Accumulation Script**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsx e2e/verify_accumulation.ts
   ```
   *Expected Result*: Script executes successfully and exits with code `0`.

3. **Verify Base Monte Carlo Script**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsx e2e/verify_monte_carlo.ts
   ```
   *Expected Result*: Script executes successfully and exits with code `0`.

4. **Verify Adversarial Accumulation Edge Cases**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsx .agents/teamwork_preview_challenger_e2e_1_2/adv_verify_accumulation_edge_cases.ts
   ```
   *Expected Result*: Script executes successfully, outputs `✔ Rigorous contribution verification passed.` and `✔ Complex withdrawal strategy state leak check passed.`, with zero errors.

5. **Verify Adversarial Monte Carlo Scrambling**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
   npx tsx .agents/teamwork_preview_challenger_e2e_1_2/adv_verify_monte_carlo_scrambling.ts
   ```
   *Expected Result*: Script executes successfully, outputs `✔ Monte Carlo runs are statistically distinct.` and `✔ PRNG seed stability verified.`, with zero errors.
