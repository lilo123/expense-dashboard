# M1.5 Drawdown & Simulator Analysis & Architectural Strategy

## Executive Summary
This report establishes the complete architectural design and implementation strategy for the pure TypeScript business logic engines `src/lib/planner/drawdownEngine.ts` and `src/lib/planner/simulator.ts`, alongside their comprehensive unit test suites. By seamlessly orchestrating the existing `types.ts`, `taxEngine.ts`, `pensionEngine.ts`, and `spendingEngine.ts` modules, the proposed architecture provides a deterministic, zero-side-effect simulation lifecycle supporting both the authenticated 7-tab Detailed Plan Builder and the public Quick Check widget.

---

## 1. System Boundary & Architectural Context

The Financial Retirement Planner project implements a clean, modular architecture separating pure domain logic from state management (`Zustand`), concurrent execution (`Web Worker`), and persistence (`Supabase / Server Actions`). 

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       src/lib/planner/types.ts                          │
│         (Zod Schemas: Account, Household, SimulationConfig, etc.)       │
└──────┬────────────────────┬────────────────────┬──────────────────┬─────┘
       ▼                    ▼                    ▼                  ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│taxEngine.ts  │    │pensionEngine │    │spendingEngine│    │drawdownEng. │
└──────┬───────┘    └───────┬──────┘    └───────┬──────┘    └─────┬───────┘
       │                    │                   │                 │        
       └────────────────────┼───────────────────┼─────────────────┘        
                            ▼                   ▼                          
                  ┌─────────────────────────────────────┐                  
                  │     src/lib/planner/simulator.ts    │                  
                  │ (Single Step / Path / Summarization)│                  
                  └──────────────────┬──────────────────┘                  
                                     │                                     
                   ┌─────────────────┴─────────────────┐                   
                   ▼                                   ▼                   
    ┌──────────────────────────────┐    ┌──────────────────────────────┐   
    │  simulation.worker.ts        │    │  QuickCheckWidget.tsx        │   
    │ (1,000 Monte Carlo Paths)    │    │ (Public Lightweight Widget)  │   
    └──────────────────────────────┘    └──────────────────────────────┘   
```

### Key Integration Boundaries
- **`types.ts`**: Provides Zod validation schemas and exported TypeScript types (`Household`, `Account`, `SimulationConfig`, `QuickCheckParams`, `SimulationResultsSummary`). All engine inputs and outputs strictly conform to these contracts.
- **`taxEngine.ts`**: Provides progressive tax calculation (`calculateTaxes`) for US and CA jurisdictions, as well as the crucial `calculateProRataCapitalGain` function used during taxable account withdrawals.
- **`pensionEngine.ts`**: Provides public and defined benefit pension calculations (`calculateAllPensions`) with claim-age adjustments and OAS clawbacks.
- **`spendingEngine.ts`**: Provides dynamic retirement withdrawal strategies (`calculateHouseholdSpending`) including Constant Dollar, Vanguard Dynamic, and Yale Endowment rules.
- **`drawdownEngine.ts` (Target)**: Responsible for executing portfolio withdrawals across multiple account types according to sequencing strategies (`taxable_first`, `tax_deferred_first`, `proportional`).
- **`simulator.ts` (Target)**: Orchestrates the annual simulation step by combining pensions, life events, spending targets, drawdown execution, tax liability calculations, secondary tax drawdowns, and portfolio market growth. Serves as the computational backbone for both the full Monte Carlo Web Worker (`simulation.worker.ts`) and the public Quick Check widget (`QuickCheckWidget.tsx`).

---

## 2. Architectural Design: `src/lib/planner/drawdownEngine.ts`

### 2.1 Responsibility & Design Philosophy
`drawdownEngine.ts` is a pure business logic engine with zero side effects. It receives a snapshot of a household's accounts, a target withdrawal amount, and a sequencing strategy, returning a new array of updated accounts along with precise categorizations of the withdrawals (e.g., tax-deferred vs. tax-free vs. capital gains).

### 2.2 Core Interfaces & Data Contracts
To maintain strict type safety and decoupling, `drawdownEngine.ts` defines and exports the following data contracts:

```typescript
import { Account, SimulationConfig } from './types';
import { calculateProRataCapitalGain } from './taxEngine';

export interface DrawdownInput {
  accounts: Account[];
  targetWithdrawal: number;
  strategy: SimulationConfig['drawdownStrategy']; // 'taxable_first' | 'proportional' | 'tax_deferred_first'
}

export interface DrawdownOutput {
  accounts: Account[]; // Deep copy of updated account objects
  totalWithdrawal: number; // Actual total amount successfully withdrawn
  taxDeferredWithdrawals: number; // Total withdrawn from 'tax_deferred' accounts
  taxFreeWithdrawals: number; // Total withdrawn from 'tax_free' accounts
  taxableWithdrawals: number; // Total withdrawn from 'taxable' accounts
  capitalGains: number; // Realized capital gains resulting from taxable withdrawals
  isDepleted: boolean; // True if total portfolio balance reached 0 before fulfilling targetWithdrawal
  unmetNeed: number; // targetWithdrawal - totalWithdrawal
}
```

### 2.3 Drawdown Sequencing Logic
The engine supports three distinct sequencing strategies governed by `SimulationConfig['drawdownStrategy']`:

1. **`taxable_first`**:
   - **Order**: `taxable` → `tax_deferred` → `tax_free`.
   - **Execution**: Exhaust all accounts of the current type before moving to the next type. Within multiple accounts of the same type, allocate withdrawals proportionally based on their starting balances in that step.

2. **`tax_deferred_first`**:
   - **Order**: `tax_deferred` → `taxable` → `tax_free`.
   - **Execution**: Exhaust all `tax_deferred` accounts first, followed by `taxable`, and finally `tax_free`. Within multiple accounts of the same type, withdraw proportionally.

3. **`proportional`**:
   - **Execution**: Withdraw from all available accounts (`taxable`, `tax_deferred`, `tax_free`) simultaneously, proportional to their balances at the start of the step. If rounding or exact account depletion leaves a residual unmet need, re-apply proportional withdrawal across any remaining positive balance accounts until the target is met or all accounts are depleted.

### 2.4 Handling Cost Basis & Realized Capital Gains
When withdrawing from a `taxable` account, `drawdownEngine` must determine how much of the withdrawal represents a return of capital (cost basis) versus realized capital gains.
- The engine imports and invokes `calculateProRataCapitalGain(withdrawal, balance, costBasis)` from `taxEngine.ts`.
- The returned `realizedGain`, `remainingBasis`, and `remainingBalance` are used to update the `Account` object and accumulate the total `capitalGains` in `DrawdownOutput`.
- For `tax_deferred` and `tax_free` accounts, cost basis is ignored for tax purposes, but balances are updated accordingly.

### 2.5 Multi-Account Proportional Helper Strategy
To ensure DRY (Don't Repeat Yourself) principles and pristine testability, `drawdownEngine.ts` implements a dedicated helper function for proportional withdrawals across a subset of accounts:

```typescript
export function withdrawFromAccounts(
  accounts: Account[],
  targetAmount: number
): {
  accounts: Account[];
  withdrawn: number;
  taxDeferred: number;
  taxFree: number;
  taxable: number;
  capitalGains: number;
}
```
**Algorithm**:
1. Calculate `totalBalance = sum(acc.balance for acc in accounts)`.
2. If `totalBalance === 0` or `targetAmount <= 0`, return the input accounts unmodified with zero withdrawal metrics.
3. If `targetAmount >= totalBalance`, withdraw the entire balance from all accounts. For taxable accounts, `realizedGain = Math.max(0, acc.balance - acc.costBasis)`. Set balance and cost basis to `0`.
4. If `targetAmount < totalBalance`, calculate each account's share: `share = targetAmount * (acc.balance / totalBalance)`. Withdraw `share` from each account, invoking `calculateProRataCapitalGain` for taxable accounts.

### 2.6 Main Delegator Function Signature
```typescript
export function calculateDrawdown(input: DrawdownInput): DrawdownOutput;
```
This function acts as the primary entry point, branching to specific sub-routines (`executeTaxableFirst`, `executeTaxDeferredFirst`, `executeProportional`) based on `input.strategy`.

---

## 3. Architectural Design: `src/lib/planner/simulator.ts`

### 3.1 Responsibility & Design Philosophy
`simulator.ts` is the master domain orchestrator. It executes the step-by-step financial lifecycle for a household over a specified retirement horizon. It ensures that income, spending, life events, drawdown sequencing, taxation, and market compounding interact correctly without mutating the original household state.

### 3.2 Single Year Simulation Step (`runSimulationStep`)
The simulation of a single year follows an explicit, 6-step deterministic flow:

```
┌────────────────────────────────────────────────────────┐
│ Step 1: Age & Horizon Calculation                      │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ Step 2: Base Income & Expense Aggregation              │
│ (Pensions + Active Life Events + Spending Target)      │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ Step 3: Initial Drawdown (Covering Net Cash Need)      │
│ (Invokes calculateDrawdown for base cash requirement)  │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ Step 4: Tax Calculation                                │
│ (Invokes calculateTaxes with all combined incomes)     │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ Step 5: Secondary Tax Drawdown                         │
│ (Invokes calculateDrawdown to cover totalTax payable)  │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ Step 6: End-of-Year Market Compounding                 │
│ (Applies marketReturn / expectedReturnOverride)        │
└────────────────────────────────────────────────────────┘
```

#### Detailed Step Breakdown
1. **Age & Horizon Calculation**:
   - `primaryAge = currentYear - household.birthYear`.
   - Calculate `yearsElapsed = currentYear - (household.birthYear + household.retirementAge)`.
   - Check if spouse exists (`household.includeSpouse`); calculate `spouseAge`.

2. **Base Income & Expense Aggregation**:
   - **Pensions**: Invoke `calculateAllPensions(household, currentYear, inflationRate)`. Sum `pension.netAmount`. Filter for Social Security / OAS versus ordinary pensions.
   - **Life Events**: Filter `household.lifeEvents` for events active in `currentYear` (matching `startYear <= currentYear <= endYear` or `age === primaryAge`). Adjust for inflation if `inflationAdjusted === true`. Aggregate `incomeLifeEvents` and `expenseLifeEvents`.
   - **Spending**: Invoke `calculateHouseholdSpending(household, currentPortfolioBalance, initialPortfolioBalance, currentYear, inflationRate, priorYearWithdrawal)`. Extract `actualWithdrawal` as the baseline spending need.

3. **Initial Drawdown (Covering Net Cash Need)**:
   - `totalInflows = sum(pension net amounts) + sum(income life events)`.
   - `totalOutflows = spendingTarget + sum(expense life events)`.
   - `netCashNeeded = Math.max(0, totalOutflows - totalInflows)`.
   - If `netCashNeeded > 0`, call `calculateDrawdown({ accounts, targetWithdrawal: netCashNeeded, strategy })`. This yields `initialDrawdownOutput`.

4. **Tax Calculation**:
   - Construct `TaxInput` for `taxEngine.ts`:
     - `taxJurisdiction`: `household.taxJurisdiction`.
     - `stateProvince`: `household.stateProvince`.
     - `includeSpouse`: `household.includeSpouse`.
     - `isAge65OrOlder`: `primaryAge >= 65`.
     - `ordinaryIncome`: `sum(non-SS/OAS pensions) + sum(income life events)`.
     - `taxDeferredWithdrawals`: `initialDrawdownOutput.taxDeferredWithdrawals`.
     - `capitalGains`: `initialDrawdownOutput.capitalGains`.
     - `socialSecurityOasIncome`: `sum(SS/OAS pensions)`.
     - `taxFreeWithdrawals`: `initialDrawdownOutput.taxFreeWithdrawals`.
   - Invoke `calculateTaxes(taxInput)`. Extract `totalTax`.

5. **Secondary Tax Drawdown**:
   - If `totalTax > 0`, execute a second drawdown against the remaining account balances: `calculateDrawdown({ accounts: initialDrawdownOutput.accounts, targetWithdrawal: totalTax, strategy })`.
   - Combine withdrawal metrics from both the initial and secondary drawdowns.

6. **End-of-Year Market Compounding**:
   - Iterate through the accounts resulting from Step 5.
   - For each account, determine the applicable growth rate: `actualRate = acc.expectedReturnOverride !== undefined ? acc.expectedReturnOverride : marketReturn`.
   - Update balance: `acc.balance = acc.balance * (1 + actualRate)`.
   - Return `SimulationStepOutput`: `{ currentYear, accounts, endingPortfolioBalance, totalWithdrawal, taxesPaid, isDepleted }`.

### 3.3 Single Path Simulation (`runSimulationPath`)
```typescript
export interface SimulationPathResult {
  pathId: number;
  isSuccess: boolean;
  finalBalance: number;
  annualBalances: number[];
}

export function runSimulationPath(
  household: Household,
  marketReturns: number[],
  simulationConfig: SimulationConfig,
  pathId: number
): SimulationPathResult;
```
- Executes `runSimulationStep` sequentially across the specified retirement horizon (`simulationConfig.retirementHorizon`).
- Maintains the evolving state of `accounts` from year to year.
- Tracks `annualBalances`. `isSuccess` is defined as `finalBalance > 0`.

### 3.4 Full Simulation Orchestration & Summarization
```typescript
export function summarizeSimulationResults(
  pathResults: SimulationPathResult[]
): SimulationResultsSummary;

export function runSimulation(
  household: Household,
  marketReturnPaths: number[][]
): SimulationResultsSummary;
```
- `summarizeSimulationResults` aggregates an array of `SimulationPathResult` objects, calculating the exact `successRate` (percentage of paths where `isSuccess === true`).
- Sorts final balances numerically to extract `medianFinalBalance` (p50), `tenthPercentileFinalBalance` (p10), and `ninetiethPercentileFinalBalance` (p90).
- Computes annual percentile breaking points for `annualEndingBalances`.
- `runSimulation` acts as the pure TypeScript orchestrator (which mirrors the Web Worker logic and serves as the direct fallback/engine test target).

### 3.5 Dual-Entry Support: Quick Check Simulator (`runQuickCheckSimulation`)
To fulfill the Dual Entry architecture specified in `PROJECT.md`, `simulator.ts` provides a dedicated, highly optimized simulation flow for the public Quick Check widget (`QuickCheckWidget.tsx`), bypassing the complex setup of full households, individual accounts, and progressive tax brackets:

```typescript
export function runQuickCheckSimulation(
  params: QuickCheckParams,
  marketReturnPaths: number[][]
): SimulationResultsSummary;
```
**Algorithm**:
1. For each path in `marketReturnPaths`, loop from `year = 1` to `params.years`.
2. Initial balance is `params.portfolio`.
3. Each year, subtract `params.withdrawal` (representing start-of-year living expenses). If balance becomes negative, clamp to `0`.
4. Apply the year's market return: `balance = balance * (1 + marketReturn)`.
5. Track annual balances and final balance.
6. Pass the resulting path results to `summarizeSimulationResults`.

### 3.6 Tradeoffs & Architectural Decisions
- **Start-of-Year Withdrawals vs. End-of-Year Withdrawals**: We explicitly establish start-of-year withdrawals followed by end-of-year market compounding. *Tradeoff*: This represents a more conservative and realistic sequencing model for retirees who require cash distributions to fund their lifestyle throughout the year, properly reflecting sequence-of-returns risk.
- **Explicit Stepwise Tax Drawdown vs. Iterative Gross-Up**: We select a two-step explicit drawdown (Step 3 initial cash need → Step 4 tax calculation → Step 5 secondary tax drawdown). *Tradeoff*: While an iterative gross-up loop theoretically converges on an exact tax-inclusive gross withdrawal, it introduces unpredictable performance overhead and potential infinite loops. The two-step explicit drawdown is highly performant, deterministic, well-suited for 1,000+ Monte Carlo paths, and perfectly captures the tax liability generated by portfolio distributions.

---

## 4. Comprehensive Unit Testing Strategy

To verify 100% test coverage and ensure zero regressions, the implementing agent must create comprehensive unit tests in `__tests__/planner/drawdownEngine.spec.ts` (and `__tests__/planner/simulator.spec.ts` if structured separately).

### 4.1 `drawdownEngine.spec.ts` Test Scenarios
1. **Strategy `taxable_first` Execution**:
   - Verify exact withdrawal order: `taxable` accounts are fully depleted before touching `tax_deferred`, and `tax_deferred` depleted before `tax_free`.
   - Verify proportional allocation when multiple `taxable` accounts exist.
2. **Strategy `tax_deferred_first` Execution**:
   - Verify `tax_deferred` accounts are fully depleted before `taxable` and `tax_free`.
3. **Strategy `proportional` Execution**:
   - Verify simultaneous withdrawals across all account types proportional to their starting balances.
   - Verify handling of odd target amounts where rounding or partial depletion occurs.
4. **Cost Basis & Capital Gains Integration**:
   - Verify `calculateProRataCapitalGain` is correctly applied to `taxable` withdrawals, accurately tracking `realizedGain` and reducing `costBasis`.
   - Verify `costBasis` is unchanged/ignored for `tax_deferred` and `tax_free` accounts.
5. **Boundary & Depletion Conditions**:
   - Verify behavior when `targetWithdrawal === 0` (accounts returned unmodified).
   - Verify behavior when `targetWithdrawal > totalPortfolioBalance` (`isDepleted === true`, `unmetNeed` accurately calculated, all account balances set to `0`).

### 4.2 `simulator.spec.ts` Test Scenarios
1. **Single Step Integration (`runSimulationStep`)**:
   - Verify correct aggregation of pensions (SS/OAS vs ordinary) and active life events.
   - Verify correct two-step drawdown interaction with `taxEngine.ts` (initial withdrawal + secondary tax withdrawal).
   - Verify `expectedReturnOverride` overrides the baseline `marketReturn` for specific accounts during end-of-year compounding.
2. **Single Path Execution (`runSimulationPath`)**:
   - Verify multi-year state progression and correct tracking of `annualBalances`.
   - Verify `isSuccess === true` when final balance > 0, and `isSuccess === false` when depleted.
3. **Full Simulation & Summarization (`runSimulation`, `summarizeSimulationResults`)**:
   - Verify accurate calculation of `successRate`.
   - Verify correct numerical sorting and extraction of p10, p50, and p90 final balances.
   - Verify correct annual percentile breaking points in `annualEndingBalances`.
4. **Quick Check Simulation (`runQuickCheckSimulation`)**:
   - Verify lightweight simulation flow correctly applies annual withdrawals and market returns to `QuickCheckParams`.
   - Verify accurate summarization matching `SimulationResultsSummary` schema.

---

## 5. Concrete Implementation Guide for Implementer

The implementing agent should execute the implementation of `drawdownEngine.ts` and `simulator.ts` following these structured phases:

```
┌────────────────────────────────────────────────────────┐
│ Phase 1: Implement drawdownEngine.ts                   │
│ (Core interfaces, proportional helper, delegator)      │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ Phase 2: Implement drawdownEngine.spec.ts              │
│ (Achieve 100% passing tests for drawdown logic)        │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ Phase 3: Implement simulator.ts                        │
│ (Single step, single path, summarization, QuickCheck)  │
└──────────────────────────┬─────────────────────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│ Phase 4: Implement simulator.spec.ts                   │
│ (Achieve 100% passing tests & verify clean tsc)        │
└────────────────────────────────────────────────────────┘
```

### Verification & Success Criteria
- **Type Definitions**: Ensure all Zod schemas and TypeScript types are cleanly imported from `src/lib/planner/types.ts`.
- **Pure Functions**: Ensure zero mutations occur on input parameters. Use deep copying (e.g., `accounts.map(acc => ({ ...acc }))`) before applying modifications.
- **Testing**: Run `npm run test __tests__/planner` to verify all existing and new unit tests pass with 100% coverage.
- **TypeScript Compilation**: Verify zero compilation errors with `npx tsc --noEmit`.
