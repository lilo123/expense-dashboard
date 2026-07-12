# Handoff Report: M1.5 Drawdown & Simulator Architecture

## 1. Observation
During the investigation of the core domain types and pure business logic engines for the Financial Retirement Planner, the following exact facts, file paths, and existing contracts were directly observed:

- **Project & Milestone Scope**:
  - `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md` (lines 7-8, 14) specifies pure TS engines for tax (`taxEngine.ts`), pension (`pensionEngine.ts`), spending (`spendingEngine.ts`), drawdown & simulation (`drawdownEngine.ts`, `simulator.ts`).
  - `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m1_core_domain_1/SCOPE.md` (lines 5-10, 19) defines M1.5 Drawdown & Simulator as a planned milestone depending on M1.1 (types), M1.2 (tax), M1.3 (pension), M1.4 (spending), requiring pure functions with zero side effects and comprehensive unit tests in `__tests__/planner/`.

- **Domain Type Definitions (`src/lib/planner/types.ts`)**:
  - Lines 4-18 (`AccountSchema`): Identifies account types (`taxable`, `tax_deferred`, `tax_free`), `balance`, `costBasis`, `expectedReturnOverride`, and `owner`.
  - Lines 99-107 (`SimulationConfigSchema`): Mandates `drawdownStrategy` (`taxable_first`, `proportional`, `tax_deferred_first`), `historicalRange`, `numPaths`, `inflationRate`, and `retirementHorizon`.
  - Lines 110-140 (`HouseholdSchema`): Enforces `taxJurisdiction` (`US` | `CA`), `birthYear`, `retirementAge`, `includeSpouse`, `accounts`, `spending`, `pensions`, and `lifeEvents`.
  - Lines 142-161 (`SimulationResultsSummarySchema`): Requires `successRate`, `medianFinalBalance`, `tenthPercentileFinalBalance`, `ninetiethPercentileFinalBalance`, and `annualEndingBalances` (with `p10`, `p50`, `p90` per year).

- **Tax Engine (`src/lib/planner/taxEngine.ts`)**:
  - Lines 3-14 (`TaxInput`): Defines required inputs, explicitly separating `ordinaryIncome`, `taxDeferredWithdrawals`, `capitalGains`, `socialSecurityOasIncome`, `taxFreeWithdrawals`, and `eligibleDividends`.
  - Lines 16-27 (`TaxOutput`): Outputs `totalTax`, `effectiveTaxRate`, `marginalTaxRate`, `federalTax`, `stateProvincialTax`, `taxableIncome`, `deductionsAndCredits`, `taxableSocialSecurityOas`, `taxableCapitalGains`.
  - Lines 113-145 (`calculateProRataCapitalGain`): Implements pro-rata capital gain calculation returning `{ realizedGain, remainingBasis, remainingBalance }`.
  - Lines 367-373 (`calculateTaxes`): Main pure delegator branching to `calculateUsTaxes` or `calculateCaTaxes`.

- **Pension Engine (`src/lib/planner/pensionEngine.ts`)**:
  - Lines 155-182 (`calculateAllPensions`): Computes pension benefits for a household for a given year, returning an array of `PensionOutput` containing `grossAmount`, `clawbackAmount`, `netAmount`, and `claimAgeAdjustmentFactor`.

- **Spending Engine (`src/lib/planner/spendingEngine.ts`)**:
  - Lines 156-178 (`calculateHouseholdSpending`): Evaluates withdrawal strategies (`constant_dollar`, `vanguard_dynamic`, `yale_endowment`) returning `SpendingOutput` with `targetWithdrawal` (requested) and `actualWithdrawal` (clamped by portfolio balance).

## 2. Logic Chain
1. **Integration Requirement**: Because `types.ts` defines the single source of truth for household data and simulation configuration, `drawdownEngine.ts` and `simulator.ts` must directly import and utilize `Household`, `Account`, `SimulationConfig`, and `SimulationResultsSummary`.
2. **Circular Dependency Resolution (Tax Gross-Up)**:
   - *Observation*: Withdrawing from `tax_deferred` accounts increases `taxDeferredWithdrawals` in `TaxInput`. Withdrawing from `taxable` accounts generates pro-rata `capitalGains` via `calculateProRataCapitalGain`. Both increase `totalTax` in `TaxOutput`.
   - *Inference*: If a household requires $X of net cash to satisfy spending and life event expenses, withdrawing exactly $X will leave a deficit once taxes are deducted.
   - *Architectural Solution*: `drawdownEngine.ts` must implement a pure, fixed-point iterative gross-up algorithm. By tentatively withdrawing `grossWithdrawal` (initially set to net shortfall), computing taxes via `calculateTaxes`, calculating `actualNet = grossWithdrawal + inflows - totalTax - expenses`, and adjusting `grossWithdrawal += delta / (1 - marginalTaxRate)`, the engine finds the exact gross withdrawal needed to hit the net cash target in a bounded loop (max 10 iterations or delta < $0.01) with zero side effects.
3. **Drawdown Sequencing**:
   - *Observation*: `SimulationConfigSchema` requires `taxable_first`, `proportional`, and `tax_deferred_first` strategies.
   - *Architectural Solution*: `drawdownEngine.ts` must branch on `config.drawdownStrategy`. For `proportional`, it calculates the sum of all account balances and withdraws `acc.balance / totalBalance * grossWithdrawal` from each account. For priority-based strategies, it drains accounts in sequence until the gross target is reached or all accounts reach $0 balance.
4. **Annual Simulation Loop & Growth Overrides**:
   - *Observation*: `AccountSchema` allows an optional `expectedReturnOverride`. `SimulationResultsSummarySchema` requires statistical percentiles (`p10`, `p50`, `p90`).
   - *Architectural Solution*: `simulator.ts` must implement `simulatePath` which loops annually over `config.retirementHorizon`. At the start of each year, it applies `acc.expectedReturnOverride ?? marketReturns[yearIndex]` to grow account balances. It then invokes `calculateHouseholdSpending`, `calculateAllPensions`, filters active `lifeEvents`, and calls `drawdownEngine` to process cash flows and taxes. `runSimulation` aggregates results across multiple paths, sorts final and annual balances in-place (`a - b`), extracts percentiles, and validates the output via `SimulationResultsSummarySchema.parse()`.
5. **Invariant Enforcement**: To comply with pure function semantics, `drawdownEngine.ts` must treat input accounts immutably, returning a newly allocated array of updated accounts. It must assert the conservation of wealth invariant: `sum(initialAccounts.balance) === sum(updatedAccounts.balance) + totalWithdrawal` (within floating-point epsilon), and guarantee no balance or cost basis drops below zero.

## 3. Caveats
- **Web Worker Compatibility**: While `simulator.ts` provides `runSimulation` for direct multi-path evaluation, `PROJECT.md` specifies that production Monte Carlo simulations (1,000 paths) will run inside a Web Worker (`simulation.worker.ts`) using Transferable Objects. The design of `simulator.ts` assumes it will be invoked directly by the Web Worker or used for synchronous/standalone unit testing.
- **Excess Cash Handling**: If annual pension inflows and income life events exceed spending and expense life events, the drawdown shortfall is $0. The current architectural design assumes excess cash is retained within the annual record as net surplus rather than forcibly reinvested into specific accounts, preserving existing account balances unchanged for that year.
- **Provincial Tax Approximation**: `taxEngine.ts` implements a simplified Canadian provincial tax estimation (~40% of federal tax payable). `drawdownEngine.ts` strictly relies on `TaxOutput.totalTax` and `marginalTaxRate` as computed by `taxEngine.ts`, without introducing additional regional tax rules.

## 4. Conclusion
The proposed architecture for `drawdownEngine.ts` and `simulator.ts` perfectly satisfies the milestone requirements for M1.5. By utilizing a fixed-point iterative tax gross-up loop, explicit drawdown sequencing branches, and rigorous annual simulation steps, the design achieves total pure function semantics, zero side effects, robust invariant preservation, and seamless interoperability with the existing domain engines (`taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`).

## 5. Verification Method
To independently verify the correctness of the subsequent implementation of `drawdownEngine.ts`, `simulator.ts`, and their test suites, execute the following verification steps:

1. **Static Type & Schema Inspection**:
   - Inspect `src/lib/planner/drawdownEngine.ts` to ensure it imports and uses `Household`, `Account`, `SimulationConfig`, `TaxOutput`, `PensionOutput`, and `SpendingOutput`.
   - Inspect `src/lib/planner/simulator.ts` to ensure it returns an object matching `SimulationResultsSummary` and explicitly invokes `SimulationResultsSummarySchema.parse()`.

2. **Run Comprehensive Unit Test Suite**:
   Execute the Jest test runner against the planner test suite to verify 100% passing tests and complete coverage of drawdown sequencing, tax gross-up, growth overrides, and percentile calculations:
   ```bash
   npm run test __tests__/planner/drawdownEngine.spec.ts
   npm run test __tests__/planner/simulator.spec.ts
   ```
   *Expected Output*: `PASS` for all test files with 0 failing tests.

3. **Verify Pure Function & Zero Side Effect Invariants**:
   Within the unit tests, verify explicit assertions confirming that input `Account[]` references remain unmodified and that `sum(initial.balance) === sum(ending.balance) + totalWithdrawal` holds true across all test cases.
