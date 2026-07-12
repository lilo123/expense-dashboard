# Handoff Report: M1.5 Drawdown & Simulator Explorer 1

## 1. Observation
- **`task_description.md`**: Directly instructed to investigate `src/lib/planner/types.ts`, `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`, and design the architecture and implementation strategy for `src/lib/planner/drawdownEngine.ts` and `src/lib/planner/simulator.ts`, along with comprehensive unit tests (`__tests__/planner/drawdownEngine.spec.ts`).
- **`PROJECT.md`**: Observed project architectural pillars including Dual Entry architecture (public Quick Check widget vs authenticated 7-tab SPA), pure business logic engines with Zod validation schemas in `src/lib/planner/types.ts`, and Web Worker Monte Carlo simulation executing 1,000 paths in parallel using Transferable Objects.
- **`SCOPE.md`**: Observed Milestone 1 status where M1.1 (Types), M1.2 (Tax), M1.3 (Pension), and M1.4 (Spending) are fully completed with 100% passing test coverage. M1.5 (Drawdown & Simulator) is marked as `PLANNED`.
- **`src/lib/planner/types.ts`**: Verified Zod schemas and inferred TypeScript types: `Account` (type: `taxable | tax_deferred | tax_free`, balance, costBasis, expectedReturnOverride), `SimulationConfig` (drawdownStrategy: `taxable_first | proportional | tax_deferred_first`, historicalRange, numPaths, inflationRate, retirementHorizon), `Household`, `SimulationResultsSummary` (successRate, medianFinalBalance, tenthPercentileFinalBalance, ninetiethPercentileFinalBalance, annualEndingBalances), and `QuickCheckParams` (portfolio, withdrawal, years).
- **`src/lib/planner/taxEngine.ts`**: Observed pure progressive tax calculation (`calculateTaxes` taking `TaxInput` and returning `TaxOutput`) and `calculateProRataCapitalGain(withdrawal, balance, costBasis)` which computes `realizedGain`, `remainingBasis`, and `remainingBalance`.
- **`src/lib/planner/pensionEngine.ts` & `spendingEngine.ts`**: Observed pure calculation engines `calculateAllPensions` and `calculateHouseholdSpending` providing baseline cash inflow/outflow targets.
- **Directory Inspection (`src/lib/planner/` & `__tests__/planner/`)**: Confirmed via directory listing that `src/lib/planner/drawdownEngine.ts` and `src/lib/planner/simulator.ts` currently do not exist, establishing a clear greenfield implementation requirement.

## 2. Logic Chain
1. **Greenfield Implementation Requirement**: Because `drawdownEngine.ts` and `simulator.ts` do not exist in `src/lib/planner/`, they must be implemented from scratch as pure TypeScript business logic engines conforming to the established domain contracts in `src/lib/planner/types.ts`.
2. **Drawdown Sequencing Strategy**: Because `SimulationConfig['drawdownStrategy']` specifies `taxable_first`, `tax_deferred_first`, and `proportional`, `drawdownEngine.ts` must implement exact sub-routines for these three sequencing rules. To maintain DRY principles and handle multiple accounts of the same type, a dedicated proportional withdrawal helper (`withdrawFromAccounts`) is required.
3. **Taxable Account Integration**: Because `taxEngine.ts` provides `calculateProRataCapitalGain`, `drawdownEngine.ts` must invoke this function whenever distributing cash from a `taxable` account to correctly update `costBasis` and track realized `capitalGains`.
4. **Deterministic Simulation Step Flow**: Because `simulator.ts` must unite pensions, spending targets, life events, drawdown execution, taxes, and market returns, a 6-step deterministic flow is required: Age calculation → Base Income/Expenses aggregation → Initial Drawdown (net cash need) → Tax calculation (`calculateTaxes`) → Secondary Tax Drawdown (covering totalTax) → End-of-year market compounding (respecting `expectedReturnOverride`).
5. **Dual-Entry Architecture Support**: Because `PROJECT.md` mandates a public Quick Check widget alongside the 7-tab SPA, `simulator.ts` must implement both `runSimulation(household, marketReturnPaths)` and a lightweight `runQuickCheckSimulation(params: QuickCheckParams, marketReturnPaths)` that directly calculates annual ending balances and summarizes results matching `SimulationResultsSummary`.
6. **Testing & Coverage Mandate**: Because `SCOPE.md` dictates 100% passing test coverage across `__tests__/planner/`, comprehensive unit tests covering all sequencing strategies, boundary depletion conditions, tax interactions, and summarization percentiles must be implemented in `drawdownEngine.spec.ts` and `simulator.spec.ts`.

## 3. Caveats
- **Market Data Injection**: The Web Worker (`simulation.worker.ts`) and market data (`src/content/historicalMarketData.ts`) belong to Milestone 2 (`M2`). Therefore, `simulator.ts` relies on injected `marketReturnPaths: number[][]` and `marketReturn: number` parameters rather than directly loading the `Float64Array`.
- **Tax Withholding vs Secondary Drawdown**: The architectural strategy employs an explicit two-step drawdown (initial withdrawal for living expenses + secondary withdrawal for calculated tax liability). This avoids infinite recursion and matches standard Monte Carlo simulation practices, but assumes the secondary tax withdrawal itself does not trigger an immediate third-order tax liability within the same step.
- **Canadian OAS Clawback Estimation**: For Canadian households, OAS clawback depends on net income. The simulation step calculates initial pensions, performs initial drawdowns, and allows `taxEngine.ts` to calculate the final OAS clawback during the tax step.

## 4. Conclusion
The architectural design and implementation strategy for M1.5 Drawdown & Simulator is fully established and documented in `analysis.md`. The implementing agent should proceed with a 4-phase execution plan:
1. Implement `src/lib/planner/drawdownEngine.ts` (defining `DrawdownInput`, `DrawdownOutput`, `withdrawFromAccounts`, and `calculateDrawdown`).
2. Implement `__tests__/planner/drawdownEngine.spec.ts` to achieve 100% passing test coverage on drawdown sequencing logic.
3. Implement `src/lib/planner/simulator.ts` (defining `runSimulationStep`, `runSimulationPath`, `summarizeSimulationResults`, `runSimulation`, and `runQuickCheckSimulation`).
4. Implement `__tests__/planner/simulator.spec.ts` to verify full simulation lifecycle correctness and clean compilation.

## 5. Verification Method
To independently verify the implementation once completed, execute the following commands and checks:
1. **TypeScript Type Checking**:
   ```bash
   npx tsc --noEmit
   ```
   *Success Condition*: Zero compilation errors across the entire project.
2. **Unit Test Execution & Coverage**:
   ```bash
   npm run test __tests__/planner
   ```
   *Success Condition*: 100% of test suites pass, including existing tests (`types`, `taxEngine`, `pensionEngine`, `spendingEngine`) and the newly created `drawdownEngine.spec.ts` and `simulator.spec.ts`.
3. **Inspection of Pure Function Compliance**:
   Inspect `src/lib/planner/drawdownEngine.ts` and `src/lib/planner/simulator.ts` to confirm that input objects (`Household`, `Account[]`) are never mutated in-place, and that deep copying (e.g., `accounts.map(acc => ({ ...acc }))`) is utilized.
