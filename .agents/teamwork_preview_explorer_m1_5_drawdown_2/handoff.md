# Handoff Report: M1.5 Drawdown Engine & Simulator Architecture

## 1. Observation
We conducted a comprehensive investigation of the core domain types and pure business logic engines within the workspace `/usr/local/google/home/duynguyenn/expense-dashboard`:
- **`src/lib/planner/types.ts`**:
  - Lines 4-18: `AccountSchema` defines accounts with `type: z.enum(['taxable', 'tax_deferred', 'tax_free'])`, `balance`, `costBasis`, and `owner`.
  - Lines 21-53: `SpendingSchema` defines spending withdrawal strategies (`constant_dollar`, `vanguard_dynamic`, `yale_endowment`).
  - Lines 56-72: `PensionSchema` defines public and private pensions (`social_security`, `cpp`, `oas`, `defined_benefit`).
  - Lines 75-96: `LifeEventSchema` defines active income/expense events based on `age` or `startYear`/`endYear`.
  - Lines 99-107: `SimulationConfigSchema` mandates drawdown strategies: `taxable_first`, `proportional`, `tax_deferred_first`, along with `historicalRange`, `numPaths`, `inflationRate`, and `retirementHorizon`.
  - Lines 110-139: `HouseholdSchema` integrates all sub-schemas, defining `taxJurisdiction: z.enum(['US', 'CA'])` and `horizonMode`.
  - Lines 142-161: `SimulationResultsSummarySchema` enforces output contracts for simulation runs (`successRate`, `medianFinalBalance`, `tenthPercentileFinalBalance`, `ninetiethPercentileFinalBalance`).
- **`src/lib/planner/taxEngine.ts`**:
  - Lines 3-27: Defines `TaxInput` and `TaxOutput` interfaces.
  - Lines 113-145: `calculateProRataCapitalGain(withdrawal, balance, costBasis)` calculates pro-rata realized gains and remaining basis.
  - Lines 151-272: `calculateUsTaxes` handles US tax rules including Social Security taxability via provisional income rules.
  - Lines 279-362: `calculateCaTaxes` handles Canadian tax rules including capital gains inclusion rates and OAS clawback calculations.
- **`src/lib/planner/pensionEngine.ts`**:
  - Lines 155-182: `calculateAllPensions(household, currentYear, inflationRate, netIncomeForOas)` calculates pension benefits for all household members, applying early/delayed claim age adjustment factors.
- **`src/lib/planner/spendingEngine.ts`**:
  - Lines 156-178: `calculateHouseholdSpending(...)` delegates to strategy calculation functions (`calculateConstantDollar`, `calculateVanguardDynamic`, `calculateYaleEndowment`), returning `targetWithdrawal` and `actualWithdrawal`.
- **Project & Milestone Scope**:
  - `.agents/orchestrator/PROJECT.md` and `.agents/sub_orch_m1_core_domain_1/SCOPE.md` verify that M1.1, M1.2, M1.3, and M1.4 are complete and fully tested. M1.5 requires pure TypeScript implementations of `drawdownEngine.ts` and `simulator.ts`, alongside unit tests in `__tests__/planner/drawdownEngine.spec.ts` achieving 100% test coverage.

## 2. Logic Chain
1. **Schema Compliance**: Because `src/lib/planner/types.ts` defines rigid Zod schemas and inferred TypeScript types (`Household`, `Account`, `SimulationConfig`, `SimulationResultsSummary`), `drawdownEngine.ts` and `simulator.ts` must directly import and utilize these types to maintain strict contract alignment and zero side-effects.
2. **Mandatory RMD / RRIF Sequencing**: Since US tax-deferred accounts have RMD rules starting at age 73 and Canadian RRSP/RRIF accounts have statutory minimum withdrawal percentages starting at age 71, `drawdownEngine.ts` must calculate and execute these mandatory distributions from `tax_deferred` accounts *before* evaluating any optional drawdown strategies (`taxable_first`, `tax_deferred_first`, `proportional`).
3. **Handling Excess RMD Cash Flow**: When mandatory RMDs exceed the net spending requirement (after deducting pensions and income life events), the remaining excess cash flow cannot be left in the tax-deferred account. It must be reinvested into a `taxable` account, increasing both its `balance` and `costBasis` equally.
4. **Circularity Resolution via Fixed-Point Iteration**: In Canadian jurisdictions, OAS clawback depends on net income (including portfolio withdrawals/capital gains), while required portfolio withdrawals depend on net OAS received. Similarly, when tax liabilities are paid from the portfolio (tax gross-up), withdrawing money to pay taxes generates additional taxable income. To solve this circular dependency in pure TypeScript without infinite loops, `drawdownEngine.ts` must implement a fixed-point iteration loop (up to 5 iterations) that recalculates trial withdrawals and taxes until the tax liability converges within a $1 tolerance.
5. **Simulation Orchestration & Percentile Aggregation**: `simulator.ts` must iterate across `numPaths` (default 1000), executing annual market returns and invoking `calculateAnnualDrawdown`. To satisfy `SimulationResultsSummarySchema`, the engine must record terminal portfolio balances across all paths, sort them in-place (`finalBalances.sort((a, b) => a - b)`), calculate the exact `successRate`, and extract `p10`, `p50`, and `p90` ending balances.

## 3. Caveats
- **Historical Market Data Source**: The exact structure of `src/content/historicalMarketData.ts` (scheduled for M2) is assumed to be an interleaved `Float64Array` of annual asset returns (`[stocks, bonds, cash, ...]`). `simulator.ts` should accept this array as an input parameter to remain pure and decoupled.
- **State Tax Assumptions**: The tax engine utilizes a simplified state/provincial tax model (e.g., flat 4% for taxable US states, 40% of federal tax for CA provinces). The drawdown engine assumes these calculations are encapsulated entirely within `taxEngine.ts` and does not attempt secondary state tax adjustments.
- **RMD Tables**: Statutory RMD divisor tables (US Uniform Lifetime Table) and RRIF withdrawal percentage tables (CA) must be hardcoded as pure lookup maps within `drawdownEngine.ts`.

## 4. Conclusion
The architecture and implementation strategy for M1.5 is fully established and ready for implementation by the designated implementer agent. 
- **`src/lib/planner/drawdownEngine.ts`**: Implement `calculateAnnualDrawdown(input: DrawdownInput): DrawdownOutput` with mandatory RMD/RRIF minimum processing, excess RMD reinvestment, support for `taxable_first`, `tax_deferred_first`, and `proportional` drawdown strategies, and a 5-iteration fixed-point loop to solve tax gross-up and OAS clawback circularities.
- **`src/lib/planner/simulator.ts`**: Implement `runSimulation(input: SimulatorInput): SimulationResultsSummary` and `runSinglePath(...)` to execute multi-year paths, applying annual asset returns, tracking portfolio depletion, and performing in-place numerical sorting to extract p10, p50, p90 balances and success rates.
- **`__tests__/planner/drawdownEngine.spec.ts`**: Implement the 5 comprehensive test suites defined in `analysis.md` covering drawdown sequencing, RMD rules, pension/life event offsets, tax circularity convergence, and depletion edge cases.

## 5. Verification Method
To independently verify the architecture and subsequent implementation:
1. **Static Type Checking & Schema Alignment**: Run the TypeScript compiler to ensure all interfaces align with Zod schemas and no type mismatches exist:
   ```bash
   npx tsc --noEmit
   ```
2. **Unit Test Execution & Coverage**: Run the test suite using Jest/npm to verify 100% passing tests across all core domain engines and the newly implemented drawdown engine:
   ```bash
   npm run test __tests__/planner
   ```
3. **Inspect Output Artifacts**: Verify the generated `SimulationResultsSummary` objects in tests match the exact constraints of `SimulationResultsSummarySchema` (e.g. `tenthPercentileFinalBalance <= medianFinalBalance <= ninetiethPercentileFinalBalance`).
