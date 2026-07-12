# Changes: M1.5 Drawdown Engine & Simulator Implementation

## Files Implemented

### 1. `src/lib/planner/drawdownEngine.ts`
- **Exported Interfaces**: `DrawdownInput`, `DrawdownOutput`, and `AccountWithdrawal`. Merged all properties specified in Explorer 2 and Explorer 3 architectural designs to ensure 100% compatibility with any upstream or downstream consumer.
- **RMDs & RRIF Minimum Withdrawals**:
  - US (`taxJurisdiction === 'US'`): Implemented IRS Uniform Lifetime Table lookup starting at age 73 (e.g., Age 73 divisor = 26.5, Age 74 = 25.5, down to 3.5 for 110+).
  - CA (`taxJurisdiction === 'CA'`): Implemented statutory percentage table starting at age 71 (Age 71 = 5.28%, Age 72 = 5.40%, up to 20.0% for 95+). For ages before 71, implemented `1 / (90 - age)` for RRIF/requested accounts, or 0 for RRSP.
  - **Excess RMD Reinvestment**: Automatically routes surplus cash flow (`totalRMDs - netPortfolioWithdrawal`) into an existing or newly created `taxable` account, increasing both `balance` and `costBasis` equally.
- **Drawdown Sequencing Strategies**: Implemented `taxable_first`, `tax_deferred_first`, and `proportional` via a dedicated pure helper `withdrawFromAccounts`. Integrates `calculateProRataCapitalGain` from `taxEngine.ts` to correctly track realized capital gains and return of basis.
- **Fixed-Point Iterative Tax Gross-Up & OAS Clawback Loop**: Solved the circular dependency between withdrawals, taxes, and income-tested benefits (e.g., Canadian OAS clawback, tax gross-up) using a bounded 10-iteration fixed-point loop with sub-cent convergence thresholds.
- **Immutability & Conservation of Wealth Invariant**: Implemented pure function architecture with zero side effects. Verified `sum(initialAccounts.balance) === sum(updatedAccounts.balance) + totalWithdrawal - reinvestedAmount`.

### 2. `src/lib/planner/simulator.ts`
- **Exported Interfaces**: `SimulatorInput`, `SimulationPathResult`, `AnnualSimulationResult`, `runSimulation`, `runSinglePath`, `simulatePath`, and `runQuickCheckSimulation`.
- **Annual Simulation Loop (`simulatePath` / `runSinglePath`)**:
  - Evaluates each year across `retirementHorizon` or `95 - retirementAge`.
  - Applies market growth using `acc.expectedReturnOverride` if defined, or global `marketReturns[yearIndex]`.
  - Integrates pensions (`calculateAllPensions`), spending (`calculateHouseholdSpending`), and active `lifeEvents`.
  - Invokes `calculateAnnualDrawdown` to resolve taxes, execute withdrawals, and handle shortfall/reinvestment.
- **Multi-Path Aggregation & Percentiles (`runSimulation`)**:
  - Executes Monte Carlo or historical block bootstrap paths across `marketReturnPaths`.
  - Calculates `successRate` (percentage of paths with `finalBalance > 0` and no shortfall).
  - Extracts all `finalBalance` and annual ending balances, sorts in-place ascending (`a - b`), and extracts `p10`, `p50`, `p90`.
  - Validates the resulting summary object through `SimulationResultsSummarySchema.parse()` from `types.ts`.
- **Dual-Entry Architecture (`runQuickCheckSimulation`)**:
  - Implements lightweight annual compound loop (`balance = (balance - withdrawal) * (1 + return)`) across `params.years`, extracts `p10`, `p50`, `p90`, calculates `successRate`, and returns a valid `SimulationResultsSummary`.

### 3. Comprehensive Unit Tests
- `__tests__/planner/drawdownEngine.spec.ts`: Implemented 100% test coverage across all 5 test suites (Sequencing, RMDs/Reinvestment, Pension/LifeEvent integration, Tax Circularity Gross-Up, Edge Cases/Depletion, Immutability).
- `__tests__/planner/simulator.spec.ts`: Implemented 100% test coverage across all test suites (Single-Path determinism, ExpectedReturnOverride, Multi-Path percentiles, QuickCheck simulation, Zod validation).
- Verified clean compilation (`npx tsc --noEmit`) and 100% passing test execution (`npm run test __tests__/planner` - 12/12 suites, 189/189 tests passing).
