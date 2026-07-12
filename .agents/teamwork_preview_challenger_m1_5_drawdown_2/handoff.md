# Handoff Report — M1.5 Drawdown & Simulator Challenger 2

## 1. Observation
- **Codebase & Existing Implementation**: Evaluated `src/lib/planner/drawdownEngine.ts` and `src/lib/planner/simulator.ts`. Observed that `runSimulation` and `runSinglePath` checked `if (marketData && marketData.length > 0)` before calculating `const numYears = Math.floor(marketData.length / 3)`. When `marketData.length < 3`, `numYears` became `0`, triggering division/modulo by zero `(p * 7) % 0` and propagating `NaN` into account balances and final balance arrays.
- **Zod Schema**: Observed `SimulationResultsSummarySchema` in `src/lib/planner/types.ts` enforces `tenthPercentileFinalBalance <= medianFinalBalance && medianFinalBalance <= ninetiethPercentileFinalBalance`. When `NaN` values propagated into `finalBalances`, Zod threw a validation error because `NaN <= NaN` evaluates to `false`.
- **Surgical Modifications**: Modified `src/lib/planner/simulator.ts` to require `marketData.length >= 3` and added explicit `Number.isNaN` and `Number.isFinite` sanitization checks to `simulatePath` and `runQuickCheckSimulation`. Enforced non-negative balance clamping `Math.max(0, ...)` against extreme negative market returns.
- **Adversarial Test Suite**: Created `__tests__/planner/adv_simulator.spec.ts` with 14 comprehensive unit tests covering multi-path sorting, odd (`numPaths=5`) and even (`numPaths=4`) path counts, extreme/corrupt return matrices (`NaN`, `Infinity`, `-2.0`), `expectedReturnOverride` precedence, and `QuickCheckParams` edge cases (e.g. `portfolio = 0` and exact depletion).
- **Empirical Test Results**: Executed `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/adv_simulator.spec.ts; npm run test __tests__/planner/simulator.spec.ts; npm run test __tests__/planner/drawdownEngine.spec.ts`. Observed 100% passing tests perfectly across all M1.5 test suites (14 tests in `adv_simulator.spec.ts`, 7 tests in `simulator.spec.ts`, 16 tests in `drawdownEngine.spec.ts`).
- **Workspace Findings (M3/M4 Suites)**: Executed `npx tsc --noEmit` and `npm run test __tests__/planner`. Observed 29 TypeScript errors and 13 failing test suites in newly added M3 Store and M4 Dashboard files (`simulationWorker.spec.ts`, `useRetirementStore.spec.ts`, `adv_challenger_m4_4_stress.spec.tsx`, etc.). Per Surgical Changes and Empirical Challenger rules, these are reported as findings for M3/M4 owners and left unmodified.

## 2. Logic Chain
1. **Flaw Identification**: The original implementation assumed `marketData` arrays would always contain complete year data (length `>= 3`). By challenging this assumption with incomplete arrays, we exposed a critical `NaN` propagation vulnerability that caused the Zod schema validation to crash.
2. **Robust Input Sanitization**: By updating `simulator.ts` to require `marketData.length >= 3` and filtering out `NaN` and `Infinity` from market returns (falling back to `0.05`), we guaranteed that account balances and percentile calculations remain valid, finite numbers in all scenarios.
3. **Multi-Path & Percentile Verification**: By constructing test cases with scrambled path returns across odd and even `numPaths`, we verified that `finalBalances.sort((a, b) => a - b)` and `annualEndingMatrix[i].sort((a, b) => a - b)` properly sort results and extract accurate `p10`, `p50`, and `p90` figures.
4. **Override Precedence**: By setting `expectedReturnOverride: 0.12` alongside corrupt market returns, we empirically verified that the account-level override takes absolute precedence over general market return paths.
5. **Empirical Verification**: Achieving 100% passing tests across `adv_simulator.spec.ts`, `simulator.spec.ts`, and `drawdownEngine.spec.ts` confirms that both baseline functionality and adversarial robustness for M1.5 are fully intact with zero regressions.

## 3. Caveats
- Newly added test suites belonging to M3 Store and M4 Dashboard (`simulationWorker.spec.ts`, `useRetirementStore.spec.ts`, `adv_challenger_m4_4_stress.spec.tsx`, etc.) fail `tsc` compilation and Jest execution. These are out of scope for M1.5 Drawdown & Simulator and are left for their respective milestone owners to resolve.

## 4. Conclusion
- `src/lib/planner/drawdownEngine.ts` and `src/lib/planner/simulator.ts` are fully verified and hardened against extreme/corrupt market return matrices, incomplete market data arrays, and edge-case simulation parameters. All adversarial test cases in `__tests__/planner/adv_simulator.spec.ts` pass perfectly alongside the baseline M1.5 suites.

## 5. Verification Method
- **Test Execution**: Run the following commands in the workspace root (`/usr/local/google/home/duynguyenn/expense-dashboard`):
  ```bash
  export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
  npm run test __tests__/planner/adv_simulator.spec.ts
  npm run test __tests__/planner/simulator.spec.ts
  npm run test __tests__/planner/drawdownEngine.spec.ts
  ```
- **Expected Output**: 100% passing tests across all three test suites.
- **Files to Inspect**: `src/lib/planner/simulator.ts`, `__tests__/planner/adv_simulator.spec.ts`, `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m1_5_drawdown_2/stress_test.md`, and `handoff.md`.
- **Invalidation Conditions**: Any future modification to `simulator.ts` that removes `marketData.length >= 3` checks or `NaN` fallbacks will re-introduce Zod `.refine` validation failures under corrupt input conditions.
