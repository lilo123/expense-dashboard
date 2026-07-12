# Architectural Analysis & Implementation Strategy: M1.5 Drawdown Engine & Simulator

## 1. Executive Summary
This report establishes the complete architectural design and implementation strategy for `src/lib/planner/drawdownEngine.ts` and `src/lib/planner/simulator.ts`, alongside their corresponding unit test suites. By building upon the pure functional foundations of `types.ts`, `taxEngine.ts`, `pensionEngine.ts`, and `spendingEngine.ts`, the proposed architecture enforces strict immutability, zero side effects, robust fixed-point iterative tax gross-up resolution, and rigorous invariant checks across all Monte Carlo simulation loops.

---

## 2. Existing Codebase Foundation

A rigorous inspection of the existing domain engines reveals a highly cohesive, robustly typed, pure functional architecture. To ensure zero side effects and perfect mathematical correctness, `drawdownEngine.ts` and `simulator.ts` must seamlessly integrate with the existing contracts:

### `src/lib/planner/types.ts`
- **Zod Schemas & Inferred Types**: Provides single-source-of-truth validation for `Household`, `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `SimulationResultsSummary`, and `QuickCheckParams`.
- **Key Constraints**: Accounts categorize into `taxable`, `tax_deferred`, and `tax_free`. `SimulationConfig` specifies `drawdownStrategy` (`taxable_first`, `proportional`, `tax_deferred_first`). `Household` enforces spouse inclusion rules and defines retirement timing (`birthYear`, `retirementAge`).

### `src/lib/planner/taxEngine.ts`
- **Taxes & Inputs**: Exports `calculateTaxes(input: TaxInput): TaxOutput`, handling both US progressive brackets/Social Security taxability and Canadian basic personal amounts/OAS clawbacks/capital gains inclusion rates.
- **Pro-Rata Capital Gains**: Exports `calculateProRataCapitalGain(withdrawal, balance, costBasis)`, which accurately splits taxable account withdrawals into `realizedGain` and return of basis.
- **Data Contract**: `TaxInput` requires explicit separation of `ordinaryIncome`, `taxDeferredWithdrawals`, `capitalGains`, `socialSecurityOasIncome`, `taxFreeWithdrawals`, and `eligibleDividends`.

### `src/lib/planner/pensionEngine.ts`
- **Pensions & Claim Adjustments**: Exports `calculateAllPensions(...)` returning `PensionOutput[]`. Handles Social Security Normal Retirement Age (NRA) adjustments, CPP adjustments, and OAS adjustments.
- **OAS Clawback Interaction**: Calculates OAS clawbacks based on `netIncomeForOas`. In Canadian tax evaluations, the `taxEngine` also independently evaluates OAS clawbacks to calculate taxable Social Security/OAS income.

### `src/lib/planner/spendingEngine.ts`
- **Withdrawal Strategies**: Exports `calculateHouseholdSpending(...)` returning `SpendingOutput`. Implements `constant_dollar`, `vanguard_dynamic` (with floor/ceiling clamping), and `yale_endowment` (weighting market and stability components).
- **Portfolio Clamping**: Distinguishes between `targetWithdrawal` (requested amount) and `actualWithdrawal` (clamped by current portfolio balance).

---

## 3. Architectural Design: `drawdownEngine.ts`

The `drawdownEngine.ts` module is responsible for orchestrating the sequencing of account withdrawals to satisfy net cash flow requirements, accounting for generated tax liabilities.

### 3.1 Key Interface Signatures
```typescript
import { Account, Household, SimulationConfig } from './types';
import { TaxOutput } from './taxEngine';
import { PensionOutput } from './pensionEngine';
import { SpendingOutput } from './spendingEngine';

export interface DrawdownInput {
  household: Household;
  accounts: Account[]; // Current state of accounts before withdrawal
  currentYear: number;
  inflationRate: number;
  spendingOutput: SpendingOutput;
  pensionOutputs: PensionOutput[];
  lifeEventIncome: number;
  lifeEventExpense: number;
  config: SimulationConfig;
}

export interface DrawdownOutput {
  accounts: Account[]; // New immutable array of updated accounts
  totalWithdrawal: number; // Gross withdrawal from accounts
  netCashDelivered: number; // Net cash available after paying taxes and fulfilling expenses
  shortfall: number; // Unfunded cash deficit (if accounts are fully depleted)
  taxOutput: TaxOutput;
  taxDeferredWithdrawals: number;
  capitalGains: number;
  taxFreeWithdrawals: number;
  taxableWithdrawals: number; // Total gross withdrawn from taxable accounts
}
```

### 3.2 Drawdown Sequencing Strategies
The engine must execute withdrawals across accounts based on `config.drawdownStrategy`:
1. **`taxable_first`**: Iterate through `taxable` accounts until depleted, then `tax_deferred` accounts, and finally `tax_free` accounts.
2. **`tax_deferred_first`**: Iterate through `tax_deferred` accounts until depleted, then `taxable` accounts, and finally `tax_free` accounts.
3. **`proportional`**: Calculate the sum of all account balances. Withdraw from each account proportionally (`account.balance / totalBalance * requiredWithdrawal`).

### 3.3 Fixed-Point Iterative Tax Gross-Up Algorithm
A critical challenge in retirement modeling is the circular dependency between withdrawals and taxes: withdrawing from tax-deferred or taxable accounts generates tax liabilities, requiring further withdrawals to pay those taxes, which generates additional taxes.

To solve this purely and deterministically without side effects, `drawdownEngine.ts` will implement a fixed-point iterative loop:

```
1. Calculate Base Cash Inflows:
   totalInflow = sum(pension.netAmount) + lifeEventIncome
   
2. Calculate Base Cash Outflows:
   totalOutflow = spendingOutput.targetWithdrawal + lifeEventExpense
   
3. Determine Initial Net Shortfall:
   targetNetCash = Math.max(0, totalOutflow - totalInflow)
   
4. Initialize Gross Withdrawal Target:
   grossWithdrawal = targetNetCash
   
5. Fixed-Point Iteration Loop (Max 10 iterations or delta < $0.01):
   a. Perform tentative withdrawal of `grossWithdrawal` across accounts via `drawdownStrategy`.
   b. Track resulting `taxDeferredWithdrawals`, `capitalGains` (via `calculateProRataCapitalGain`), and `taxFreeWithdrawals`.
   c. Assemble `TaxInput` using pension gross amounts, life event income (as ordinaryIncome), and withdrawal breakdowns.
   d. Execute `calculateTaxes(taxInput)` to determine `taxOutput.totalTax`.
   e. Calculate actual net cash delivered:
      actualNet = totalInflow + grossWithdrawal - taxOutput.totalTax - lifeEventExpense
   f. Calculate net discrepancy:
      delta = spendingOutput.targetWithdrawal - actualNet
   g. Break if Math.abs(delta) < 0.01 OR if all accounts are fully depleted (total remaining balance === 0).
   h. Update grossWithdrawal:
      grossWithdrawal += delta / (1 - taxOutput.marginalTaxRate) // Accelerated convergence using marginal rate
      
6. Construct Final Output:
   Return the immutable array of updated accounts, final tax output, withdrawal summaries, and any remaining shortfall.
```

### 3.4 Invariant Guarantees & Zero Side Effects
- **Immutability**: Input `accounts` are never modified. A deep copy or new object mapping (`{ ...acc, balance: newBalance, costBasis: newBasis }`) is returned.
- **Conservation of Wealth Invariant**: Before returning, verify:
  `sum(initialAccounts.balance) === sum(updatedAccounts.balance) + totalWithdrawal` (within floating-point epsilon `1e-9`).
- **Non-Negative Constraints**: Ensure no account balance or cost basis falls below zero.
- **Basis Consistency**: For taxable accounts, ensure `costBasis <= balance` unless a market loss occurred prior, in which case `costBasis` reduces exactly by the principal withdrawn.

---

## 4. Architectural Design: `simulator.ts`

The `simulator.ts` module coordinates the annual progression over the retirement horizon, applying market returns, evaluating cash flows, invoking the drawdown engine, and aggregating multi-path results into statistical percentiles.

### 4.1 Key Interface Signatures
```typescript
import { Household, SimulationConfig, SimulationResultsSummary } from './types';
import { TaxOutput } from './taxEngine';
import { DrawdownOutput } from './drawdownEngine';

export interface AnnualSimulationResult {
  year: number;
  age: number;
  startingBalance: number;
  endingBalance: number;
  marketGrowth: number;
  totalWithdrawal: number;
  taxesPaid: number;
  pensionIncome: number;
  spendingTarget: number;
  actualSpending: number;
  shortfall: number;
}

export interface SimulationPathResult {
  pathIndex: number;
  success: boolean;
  finalBalance: number;
  annualResults: AnnualSimulationResult[];
}

export function simulatePath(
  household: Household,
  marketReturns: number[],
  config: SimulationConfig,
  pathIndex: number
): SimulationPathResult;

export function runSimulation(
  household: Household,
  marketDataMatrix: number[][],
  configOverride?: SimulationConfig
): SimulationResultsSummary;
```

### 4.2 Annual Simulation Loop Sequence (`simulatePath`)
For each year `currentYear` from `baseYear` (`birthYear + retirementAge`) to `baseYear + config.retirementHorizon - 1`:

1. **Market Growth (Start of Year)**:
   - For each account, determine the growth rate: use `account.expectedReturnOverride` if defined; otherwise use `marketReturns[yearIndex]`.
   - Compute `newBalance = account.balance * (1 + growthRate)`.
   - Track total `marketGrowth`.
2. **Determine Cash Flows & Spending**:
   - Compute `currentPortfolioBalance = sum(accounts.balance)`.
   - Evaluate `calculateHouseholdSpending(...)`, `calculateAllPensions(...)`, and filter active `lifeEvents`.
3. **Execute Drawdown Engine**:
   - Invoke `drawdownEngine({ household, accounts, ... })` to resolve taxes and execute withdrawals.
4. **Record Annual Result**:
   - Assemble `AnnualSimulationResult` containing starting/ending balances, tax totals, withdrawals, and shortfalls.
5. **Depletion Handling**:
   - If `shortfall > 0` and total account balance is `0`, record failure state (`success = false`), but allow loop to continue to accurately track compounding deficits.

### 4.3 Multi-Path Aggregation & Percentile Calculations (`runSimulation`)
- Execute `simulatePath` across all paths provided in `marketDataMatrix`.
- **Success Rate**: `(number of paths with finalBalance > 0 and no shortfall) / totalPaths * 100`.
- **Final Balance Percentiles**:
  - Extract all `finalBalance` values into an array.
  - Sort array in ascending numerical order (`a - b`).
  - Calculate `p10 = sorted[Math.floor(len * 0.10)]`, `p50 = sorted[Math.floor(len * 0.50)]`, `p90 = sorted[Math.floor(len * 0.90)]`.
- **Annual Ending Balances**:
  - For each year in the horizon, extract ending balances across all paths, sort, and compute `p10`, `p50`, `p90`.
- **Zod Verification**: Pass the resulting summary through `SimulationResultsSummarySchema.parse()` to guarantee contract adherence.

---

## 5. Comprehensive Unit Testing Strategy

To ensure 100% test coverage and absolute mathematical rigor, `__tests__/planner/drawdownEngine.spec.ts` and `__tests__/planner/simulator.spec.ts` must implement the following test scenarios:

### 5.1 `drawdownEngine.spec.ts` Scenarios
1. **Drawdown Strategy Verification**:
   - Test `taxable_first`, `tax_deferred_first`, and `proportional` against identical account balances to confirm exact withdrawal sequencing.
2. **Pro-Rata Capital Gains & Tax Gross-Up**:
   - Test a scenario where a withdrawal from a taxable account with $100k balance and $20k basis triggers capital gains. Verify the fixed-point loop correctly increases the gross withdrawal to net the required cash.
3. **Multi-Jurisdiction Tax Handling**:
   - Verify `US` household with Social Security provisional income vs `CA` household with OAS clawback and dividend tax credits.
4. **Account Depletion & Shortfall**:
   - Request $100k withdrawal from a portfolio with only $60k remaining. Verify accounts drain exactly to $0, `shortfall` equals $40k, and no negative balances occur.
5. **Immutability & Invariant Checks**:
   - Assert that input account objects retain identical references and properties before and after execution. Verify `sum(initial) === sum(ending) + grossWithdrawals`.

### 5.2 `simulator.spec.ts` Scenarios
1. **Single Path Determinism**:
   - Provide a static flat market return array (`[0.05, 0.05, ...]`) and verify exact annual progression across a 30-year horizon.
2. **Account Expected Return Override**:
   - Test a household where one account has `expectedReturnOverride: 0.03`. Verify it ignores the global market return array.
3. **Multi-Path Aggregation & Percentiles**:
   - Provide 10 distinct market return paths resulting in known final balances ($0 to $1M). Verify exact `p10`, `p50`, `p90`, and `successRate` calculations.
4. **Zod Contract Adherence**:
   - Verify that `runSimulation` output successfully validates against `SimulationResultsSummarySchema`.
