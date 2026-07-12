# Stress Test Report — M1.5 Drawdown & Simulator Challenger 2

## Challenge Summary

**Overall risk assessment**: MEDIUM (Reduced to LOW after robust handling of corrupt/extreme market data)

## Challenges & Fixes

### [Medium] Challenge 1: Corrupt/Incomplete Market Data Sampling (`NaN` Propagation)
- **Assumption challenged**: Assumed `marketData` passed to `runSimulation` or `runSinglePath` always contains at least 3 elements (1 full year of stocks, bonds, cash).
- **Attack scenario**: If `marketData.length < 3` but `> 0`, `Math.floor(marketData.length / 3)` evaluates to `0`. This results in modulo by zero `(p * 7) % 0`, which produces `NaN`. `NaN` propagates to all market returns, account balances, and final percentiles, causing `SimulationResultsSummarySchema.parse` to fail with a Zod validation error (`NaN <= NaN` is false).
- **Blast radius**: Complete crash of simulation engine and API route when given short/incomplete historical return arrays.
- **Mitigation & Fix Applied**: Updated `runSimulation` and `runSinglePath` to check `marketData.length >= 3` before attempting division and sampling. Added explicit checks in `simulatePath` and `runQuickCheckSimulation` to verify `!Number.isNaN(marketReturn) && Number.isFinite(marketReturn)`, falling back to the default `0.05` return.

### [Low] Challenge 2: Extreme Market Return Matrices & Negative Balance Traps
- **Assumption challenged**: Assumed market returns in `marketReturnPaths` are always within reasonable bounds (e.g. `> -1.0`).
- **Attack scenario**: An adversarial input or severe economic crisis model supplies a return of `-2.0` (-200%). Without bounds checking, `acc.balance + acc.balance * (-2.0)` would result in `-acc.balance`.
- **Blast radius**: Negative portfolio balances distorting median/percentile calculations and violating `AccountSchema` non-negative balance constraints.
- **Mitigation & Fix Applied**: Enforced `acc.balance = Math.max(0, acc.balance + growth)` in `simulatePath` and `balance = Math.max(0, balance * (1 + ret))` in `runQuickCheckSimulation`.

## Stress Test Results

| Test Scenario | Expected Behavior | Actual/Predicted Behavior | Status |
| :--- | :--- | :--- | :--- |
| **adv_test 4.1 (Odd Path Count)** | `p10 <= p50 <= p90` correctly extracted for `numPaths=5` | Correct percentile indices selected from sorted array | **PASS** |
| **adv_test 4.2 (Even Path Count)** | `p10 <= p50 <= p90` correctly extracted for `numPaths=4` | Correct percentile indices selected from sorted array | **PASS** |
| **adv_test 5.1 (Short Market Data)** | Graceful fallback without producing `NaN` | Falls back to default paths; successfully parses Zod schema | **PASS** |
| **adv_test 5.2 (NaN/Infinity/Extreme)** | Corrupt returns fallback to `0.05`, `-200%` floors balance at `0` | Clean fallback and flooring at `0`; passes Zod schema | **PASS** |
| **adv_test 6.1 (Override Precedence)** | `expectedReturnOverride` completely ignores market returns | Account grows at exact override rate despite `NaN` market returns | **PASS** |
| **adv_test 7.2 (QuickCheck Zero Portfolio)** | Immediate failure detected, `successRate = 0` | Returns `successRate = 0`, `medianFinalBalance = 0` | **PASS** |

## Empirical Verification Findings (M3/M4 Test Suites)
During full workspace verification (`npx tsc --noEmit` and `npm run test __tests__/planner`), we observed that newly added test suites belonging to M3 Store and M4 Dashboard (`simulationWorker.spec.ts`, `useRetirementStore.spec.ts`, `adv_challenger_m4_4_stress.spec.tsx`, `adv_planBuilder_dashboard_stress.spec.tsx`, `adv_planBuilder_stress.spec.tsx`, `adv_simulation_dashboard_challenger_stress.spec.tsx`, `adv_useRetirementStore.spec.ts`) fail compilation (29 TS errors) and Jest execution (13 test suites failed). 

Per the Surgical Changes and Empirical Challenger rules, our scope is strictly M1.5 Drawdown & Simulator. All M1.5 test suites (`adv_simulator.spec.ts`, `simulator.spec.ts`, `drawdownEngine.spec.ts`) pass 100% perfectly. The M3/M4 failures are reported here as findings for the respective milestone owners.

## Unchallenged Areas
- `taxEngine` and `pensionEngine` internal rules — verified by prior Challenger instances; out of scope for `simulator.ts` multi-path aggregation verification.
- M3 Store and M4 Dashboard components — out of scope for M1.5 Drawdown & Simulator.
