# Task Description: M1.5 Drawdown Engine & Simulator Implementation

## Objective
Implement `src/lib/planner/drawdownEngine.ts` and `src/lib/planner/simulator.ts`, alongside their comprehensive unit tests (`__tests__/planner/drawdownEngine.spec.ts` and `__tests__/planner/simulator.spec.ts`), as pure TypeScript business logic engines with 100% test coverage and clean compilation (`npx tsc --noEmit` and `npm run test __tests__/planner`).

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Loaded Domain Skill
Load and follow the Jetski skill at: `/google/src/files/head/depot/google3/research/omega/teamwork/playbooks/greenfield_development/SKILL.md`

## Input Information & Core Contracts
- Core Domain Types & Engines: `src/lib/planner/types.ts`, `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`
- Project Scope: `.agents/orchestrator/PROJECT.md`
- Milestone Scope: `.agents/sub_orch_m1_core_domain_1/SCOPE.md`
- Explorer 1 Analysis: `.agents/teamwork_preview_explorer_m1_5_drawdown_1/handoff.md`
- Explorer 2 Analysis: `.agents/teamwork_preview_explorer_m1_5_drawdown_2/analysis.md`
- Explorer 3 Analysis: `.agents/teamwork_preview_explorer_m1_5_drawdown_3/analysis.md`

## Architectural & Implementation Requirements

### 1. `src/lib/planner/drawdownEngine.ts`
- **Interfaces**: Export `DrawdownInput`, `DrawdownOutput`, and `AccountWithdrawal`.
- **RMDs & RRIF Minimum Withdrawals**:
  - US (`taxJurisdiction === 'US'`): Traditional IRA / 401(k) (`tax_deferred`). RMD starts at age 73 (Uniform Lifetime Table lookup, e.g., age 73 divisor = 26.5, age 74 = 25.5, etc. `RMD = balance / divisor`).
  - CA (`taxJurisdiction === 'CA'`): RRSP/RRIF (`tax_deferred`). RRIF minimum starts at age 71 (Age 71 = 5.28%, Age 72 = 5.40%, etc.; before age 71, `1 / (90 - age)` if RRIF/requested, or 0 if RRSP).
  - **Excess RMD Reinvestment**: If mandatory RMDs exceed the net portfolio withdrawal needed to satisfy spending and expense life events, the excess cash flow (`totalRMDs - netPortfolioWithdrawal`) is automatically reinvested into a `taxable` account (increasing both `balance` and `costBasis` equally).
- **Drawdown Sequencing Strategies**: `taxable_first`, `tax_deferred_first`, `proportional`.
  - Whenever withdrawing from a `taxable` account, invoke `calculateProRataCapitalGain(withdrawal, balance, costBasis)` from `taxEngine.ts` to correctly split into `realizedGain` and return of basis, updating `costBasis` accordingly.
  - For `proportional`, calculate total balance of available accounts and withdraw proportionally (`acc.balance / totalBalance * requiredWithdrawal`).
- **Fixed-Point Iterative Tax Gross-Up & OAS Clawback Loop**:
  - To solve the circular dependency between withdrawals, taxes, and income-tested benefits (e.g., Canadian OAS clawback, pro-rata capital gains, tax gross-up), implement a fixed-point iteration loop (up to 5-10 iterations or delta < $0.01 / $1.00).
  - Tentatively withdraw `currentWithdrawalTarget` (initially set to base net portfolio shortfall), compute taxes via `calculateTaxes`, determine actual net cash delivered, calculate delta, and adjust `currentWithdrawalTarget`.
- **Immutability & Conservation of Wealth Invariant**: Input `accounts` are never modified in-place. Verify `sum(initialAccounts.balance) === sum(updatedAccounts.balance) + totalWithdrawal` (within floating-point epsilon). Ensure no balance or cost basis drops below zero.

### 2. `src/lib/planner/simulator.ts`
- **Interfaces**: Export `SimulatorInput`, `SimulationPathResult`, `AnnualSimulationResult`, `runSimulation`, `runSinglePath`, and `runQuickCheckSimulation`.
- **Annual Simulation Loop (`runSinglePath` / `simulatePath`)**:
  - For each year in the horizon (`retirementHorizon` or `95 - retirementAge`):
  - Apply market growth: use `acc.expectedReturnOverride` if defined; otherwise use `marketReturn` / `marketReturns[yearIndex]`. `newBalance = balance * (1 + growthRate)`.
  - Evaluate pensions (`calculateAllPensions`) and spending (`calculateHouseholdSpending`), filter active `lifeEvents`.
  - Invoke `calculateAnnualDrawdown` / `drawdownEngine` to resolve taxes, execute withdrawals, and handle shortfall/reinvestment.
  - Track annual ending balances and check for portfolio depletion (`endingPortfolioBalance <= 0`).
- **Multi-Path Aggregation & Percentiles (`runSimulation`)**:
  - Execute paths across `marketReturnPaths: number[][]`.
  - Calculate `successRate` (percentage of paths with `finalBalance > 0` and no shortfall).
  - Extract all `finalBalance` values, sort in-place (`a - b`), and calculate `p10`, `p50`, `p90`.
  - For each year in the horizon, extract ending balances across all paths, sort, and compute `p10`, `p50`, `p90`.
  - Validate the resulting summary object through `SimulationResultsSummarySchema.parse()` from `types.ts`.
- **Dual-Entry Architecture (`runQuickCheckSimulation`)**:
  - Implement `runQuickCheckSimulation(params: QuickCheckParams, marketReturnPaths: number[][]): SimulationResultsSummary` that performs a simplified annual compound loop (`balance = (balance - withdrawal) * (1 + return)`) across `params.years`, extracts `p10`, `p50`, `p90`, calculates `successRate`, and returns a valid `SimulationResultsSummary`.

### 3. Comprehensive Unit Tests (`__tests__/planner/drawdownEngine.spec.ts` & `simulator.spec.ts`)
- Achieve 100% test coverage across all test suites defined in Explorer 2 & 3's analysis (Sequencing, RMDs/Reinvestment, Pension/LifeEvent integration, Tax Circularity Gross-Up, Edge Cases/Depletion, Single-Path determinism, ExpectedReturnOverride, Multi-Path percentiles, QuickCheck simulation, and Zod validation).
- Verify clean compilation (`npx tsc --noEmit`) and 100% passing test execution (`npm run test __tests__/planner`).

## Output Requirements
- Write `changes.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/worker_m1_5_drawdown_1`) detailing all implemented logic.
- Write `handoff.md` in your working directory following the Handoff Protocol, explicitly documenting `npx tsc --noEmit` and `npm run test __tests__/planner` passing outputs.
- Send a completion message to your parent orchestrator (`sub_orch_m1_core_domain_1`).
