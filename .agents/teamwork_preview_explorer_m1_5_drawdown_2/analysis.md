# Architectural Analysis & Implementation Strategy: M1.5 Drawdown Engine & Simulator

**Executive Summary:**
This report establishes the complete architectural design, data flow, and implementation strategy for `src/lib/planner/drawdownEngine.ts` and `src/lib/planner/simulator.ts`, alongside comprehensive unit testing scenarios for `__tests__/planner/drawdownEngine.spec.ts`. By leveraging pure TypeScript business logic engines and establishing fixed-point iteration loops for circular tax/pension dependencies, the design guarantees robust handling of RMDs/RRIF minimums, tax efficiency, dynamic drawdown sequencing, and strict interface alignment with Zod schemas.

---

## 1. Investigation & Codebase Synthesis

### Existing Core Engines & Schema Alignment
Our inspection of the core domain files revealed strict typing and pure function contracts that must be preserved:
- **`src/lib/planner/types.ts`**: Defines Zod validation schemas (`Household`, `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `SimulationResultsSummary`). The `SimulationConfig` schema mandates three drawdown strategies: `taxable_first`, `proportional`, and `tax_deferred_first`. Account types are strictly partitioned into `taxable`, `tax_deferred`, and `tax_free`.
- **`src/lib/planner/taxEngine.ts`**: Provides `calculateTaxes(input: TaxInput): TaxOutput`, handling progressive brackets, US Social Security taxability (provisional income rules), Canadian OAS clawback, capital gains inclusion rates, and pro-rata capital gains calculations (`calculateProRataCapitalGain`).
- **`src/lib/planner/pensionEngine.ts`**: Computes public pension benefits (`calculateAllPensions`) with claim-age adjustments. Notably, Canadian OAS calculations accept an optional `netIncomeForOas` parameter to determine clawbacks, establishing an interdependency with drawdown tax calculations.
- **`src/lib/planner/spendingEngine.ts`**: Computes annual withdrawal targets (`calculateHouseholdSpending`) via Constant Dollar, Vanguard Dynamic, or Yale Endowment strategies, returning `targetWithdrawal` and `actualWithdrawal`.

---

## 2. Architecture & Implementation Strategy: `drawdownEngine.ts`

### Core Responsibilities & Function Signatures
The drawdown engine calculates the exact distribution of withdrawals across a household's accounts for a single year, updates account balances/cost bases, accounts for required minimum distributions (RMDs), incorporates life events/pensions, and calculates net tax liabilities.

```typescript
import { Household, Account, SimulationConfig } from './types';
import { calculateTaxes, TaxInput, TaxOutput, calculateProRataCapitalGain } from './taxEngine';
import { calculateAllPensions, PensionOutput } from './pensionEngine';
import { calculateHouseholdSpending, SpendingOutput } from './spendingEngine';

export interface DrawdownInput {
  household: Household;
  accounts: Account[]; // Current state of accounts in year t
  currentYear: number;
  inflationRate: number;
  priorYearWithdrawal?: number;
}

export interface AccountWithdrawal {
  accountId: string;
  withdrawalAmount: number;
  realizedCapitalGain: number;
  type: Account['type'];
}

export interface DrawdownOutput {
  currentYear: number;
  startingPortfolioBalance: number;
  endingPortfolioBalance: number;
  targetSpendingWithdrawal: number;
  totalCashRequirement: number;
  nonPortfolioIncome: number; // Pensions + Income Life Events
  netPortfolioWithdrawal: number; // Cash needed from accounts
  actualPortfolioWithdrawal: number; // Total withdrawn (including tax gross-up & RMDs)
  reinvestedAmount: number; // Excess RMDs reinvested into taxable accounts
  accountWithdrawals: AccountWithdrawal[];
  updatedAccounts: Account[];
  taxes: TaxOutput;
  pensions: PensionOutput[];
  spendingOutput: SpendingOutput | null;
  isDepleted: boolean;
}

export function calculateAnnualDrawdown(input: DrawdownInput): DrawdownOutput;
```

### Data Flow & Execution Sequence

```
[ Inputs: Household, Accounts, Year, Inflation ]
                       │
                       ▼
1. Compute Pensions & Active Life Events (Income vs Expense)
                       │
                       ▼
2. Determine Base Spending Need (spendingEngine) & Total Cash Requirement
                       │
                       ▼
3. Calculate Mandatory RMDs / RRIF Minimums (Satisfied from tax_deferred first)
                       │
                       ▼
4. Determine Net Portfolio Shortfall / Excess RMD Reinvestment
                       │
                       ▼
5. Apply Drawdown Strategy (taxable_first, tax_deferred_first, proportional)
                       │
                       ▼
6. Fixed-Point Iteration Loop: Tax Gross-Up & OAS Clawback True-Up
                       │
                       ▼
[ Output: Updated Accounts, Taxes, Withdrawals, Reinvestment ]
```

### Key Architectural Mechanisms

#### 1. RMDs and RRIF Minimum Withdrawals
Mandatory withdrawals from `tax_deferred` accounts must occur before evaluating optional drawdown strategies.
- **US Jurisdiction (`taxJurisdiction === 'US'`)**: Applies to Traditional IRAs / 401(k)s. Based on SECURE 2.0 Act, RMDs begin at age 73. The engine will utilize a standard IRS Uniform Lifetime Table lookup (e.g., Age 73 divisor = 26.5, Age 74 = 25.5, etc.). `RMD = account.balance / divisor`.
- **CA Jurisdiction (`taxJurisdiction === 'CA'`)**: Applies to RRSP/RRIF accounts. By age 71, RRSPs are treated as RRIFs. The prescribed minimum withdrawal schedule applies: before age 71, `1 / (90 - age)`; at age 71+, statutory percentage table (Age 71 = 5.28%, Age 72 = 5.40%, etc.). `RMD = account.balance * percentage`.
- **Excess RMD Reinvestment**: If total RMDs exceed the net portfolio withdrawal needed to satisfy spending and expense life events, the net portfolio shortfall becomes zero. The excess cash flow (`totalRMDs - netPortfolioWithdrawal`) is automatically reinvested into a `taxable` account (or creates a new taxable brokerage account if none exists), adding to both `balance` and `costBasis`.

#### 2. Drawdown Sequencing Strategies
When RMDs are insufficient to cover the net cash requirement, the remaining shortfall is drawn from accounts based on `simulationConfig.drawdownStrategy`:
- **`taxable_first`**:
  1. `taxable` accounts: Withdraw up to available balance. Compute realized capital gains using `calculateProRataCapitalGain(withdrawal, balance, costBasis)`.
  2. `tax_deferred` accounts: Withdraw remaining shortfall up to available balance.
  3. `tax_free` accounts: Withdraw remaining shortfall (TFSA / Roth IRA).
- **`tax_deferred_first`**:
  1. `tax_deferred` accounts (beyond RMDs).
  2. `taxable` accounts.
  3. `tax_free` accounts.
- **`proportional`**:
  - Calculate total available balance across all accounts (`totalBalance = sum(acc.balance)`).
  - For each account, `targetDraw = shortfall * (acc.balance / totalBalance)`.
  - Withdraw target amounts, updating balances and calculating pro-rata capital gains for taxable accounts.

#### 3. Resolving Circular Dependencies: Fixed-Point Iteration Loop
A major architectural challenge in retirement modeling is the circular dependency between withdrawals, taxes, and income-tested benefits:
- **Canadian OAS Clawback**: OAS benefits reduce the portfolio withdrawal needed. However, OAS clawback depends on net income, which includes taxable withdrawals and realized capital gains from the portfolio.
- **Tax Gross-Up**: If taxes are paid out of the portfolio, withdrawing money to pay the tax increases taxable income, generating additional tax liability.

**Resolution Strategy (Fixed-Point Iteration):**
```typescript
let currentWithdrawalTarget = baseNetPortfolioShortfall;
let previousTaxTotal = 0;
let oasClawback = 0;
let finalTaxes: TaxOutput;
let finalAccounts = [...initialAccounts];

// Iterate up to 5 times to achieve convergence
for (let iteration = 0; iteration < 5; iteration++) {
  // 1. Perform trial drawdown with currentWithdrawalTarget
  const trialResults = performDrawdownSequence(initialAccounts, currentWithdrawalTarget, strategy, rmds);
  
  // 2. Prepare TaxInput
  const taxInput: TaxInput = {
    taxJurisdiction: household.taxJurisdiction,
    stateProvince: household.stateProvince,
    includeSpouse: household.includeSpouse,
    isAge65OrOlder: currentAge >= 65,
    ordinaryIncome: pensions.nonOas + incomeLifeEvents,
    taxDeferredWithdrawals: trialResults.taxDeferredTotal,
    capitalGains: trialResults.capitalGainsTotal,
    socialSecurityOasIncome: pensions.oasOrSs,
    taxFreeWithdrawals: trialResults.taxFreeTotal,
  };

  // 3. Calculate taxes (which handles OAS clawback internally in taxEngine)
  finalTaxes = calculateTaxes(taxInput);

  // 4. Check convergence
  const taxDifference = Math.abs(finalTaxes.totalTax - previousTaxTotal);
  if (taxDifference < 1.0) { // Converged within $1
    finalAccounts = trialResults.updatedAccounts;
    break;
  }

  // 5. Update target for next iteration (add tax liability to base shortfall)
  currentWithdrawalTarget = baseNetPortfolioShortfall + finalTaxes.totalTax;
  previousTaxTotal = finalTaxes.totalTax;
  finalAccounts = trialResults.updatedAccounts;
}
```

---

## 3. Architecture & Implementation Strategy: `simulator.ts`

### Core Responsibilities & Function Signatures
The simulator orchestrates multi-year Monte Carlo or historical block bootstrap simulations across a defined retirement horizon, evaluating portfolio success rates and aggregate terminal balance percentiles.

```typescript
import { Household, SimulationConfig, SimulationResultsSummary } from './types';
import { calculateAnnualDrawdown, DrawdownInput, DrawdownOutput } from './drawdownEngine';

export interface SimulatorInput {
  household: Household;
  marketData: Float64Array; // Interleaved historical returns [stocks, bonds, cash, stocks, bonds, ...]
  configOverride?: SimulationConfig;
}

export interface SimulationPathResult {
  pathId: number;
  isSuccessful: boolean;
  finalBalance: number;
  annualResults: {
    year: number;
    endingBalance: number;
    totalTaxes: number;
    totalWithdrawal: number;
  }[];
}

export function runSimulation(input: SimulatorInput): SimulationResultsSummary;
export function runSinglePath(household: Household, config: SimulationConfig, startYearIndex: number, marketData: Float64Array): SimulationPathResult;
```

### Simulation Execution & Optimization
1. **Horizon Determination**:
   - `horizonMode === 'fixed_years'`: Uses `simulationConfig.retirementHorizon` (default 30).
   - `horizonMode === 'life_expectancy'`: Sets horizon to `95 - retirementAge`.
2. **Path Generation & Market Data Sampling**:
   - Based on `simulationConfig.historicalRange` (`most_recent_20_years`, `most_recent_50_years`, `all_125_years`), determine valid starting indices within `marketData`.
   - Use a seeded deterministic PRNG (if `simulationConfig.seed` is provided) or sequential block bootstrapping to run `numPaths` (default 1,000) iterations.
3. **Annual Loop Execution**:
   - For each year in the horizon, retrieve asset returns `[r_stocks, r_bonds, r_cash]` from `marketData`.
   - Apply returns to each account based on `account.assetAllocation` or `account.expectedReturnOverride`. `newBalance = balance * (1 + weightedReturn)`.
   - Invoke `calculateAnnualDrawdown(...)` to execute withdrawals and tax settlements.
   - Track annual ending balances and check for portfolio depletion (`endingPortfolioBalance <= 0`).
4. **Percentile Aggregation (`SimulationResultsSummary`)**:
   - Store all terminal portfolio balances in a `Float64Array` or numerical array.
   - Perform in-place numerical sorting: `finalBalances.sort((a, b) => a - b)`.
   - Compute exact index positions for percentiles: `p10 = finalBalances[Math.floor(numPaths * 0.10)]`, `p50 = finalBalances[Math.floor(numPaths * 0.50)]`, `p90 = finalBalances[Math.floor(numPaths * 0.90)]`.
   - Compute `successRate = (successfulPaths / numPaths) * 100`.
   - Construct and return the final summary object adhering strictly to `SimulationResultsSummarySchema`.

---

## 4. Edge Cases, Tax Efficiency & Protections

| Edge Case / Scenario | Mechanism & Resolution Strategy |
| :--- | :--- |
| **Complete Portfolio Depletion** | If `endingPortfolioBalance <= 0`, clamp account balances to `0`. Flag `isDepleted = true`. Ensure subsequent years in the simulation path register `0` balance and zero taxes on withdrawals, marking the path as failed in success rate calculations. |
| **RMD Exceeds Total Cash Requirement** | Mandatory withdrawals must be executed regardless of spending need. The excess cash flow (`RMD - cashNeed`) is placed into a `taxable` account, increasing its `balance` and `costBasis` equally (establishing a fresh tax basis). |
| **Cost Basis Exceeds Balance (Market Losses)** | When withdrawing from a taxable account where `costBasis >= balance`, `calculateProRataCapitalGain` correctly returns `realizedGain = 0` and reduces `costBasis` by the withdrawal amount, preventing negative taxable gains. |
| **OAS Clawback & Tax Gross-Up Circularity** | Solved via the 5-iteration fixed-point loop. If convergence is not achieved within $1 after 5 iterations, the loop terminates and adopts the last calculated state, ensuring bounded computation time and preventing infinite loops. |
| **Single vs. Joint/Spouse Account Ownership** | In household calculations, verify `includeSpouse` before processing spousal accounts/pensions. Spousal RMDs are calculated independently using the spouse's age and birth year. |
| **Zero Spending / High Pension Inflow** | If guaranteed non-portfolio income (pensions + income life events) exceeds total spending needs, `netPortfolioWithdrawal` becomes `0`. Only mandatory RMDs are processed, and all surplus income is reinvested or tracked as surplus cash. |

---

## 5. Unit Test Scenarios: `__tests__/planner/drawdownEngine.spec.ts`

To ensure 100% test coverage and absolute reliability, the test suite must implement the following test suites:

### Suite 1: Drawdown Strategy Sequencing
- **Test 1.1 (Taxable First)**: Verify withdrawals deplete taxable accounts entirely before touching tax-deferred, and tax-deferred before tax-free.
- **Test 1.2 (Tax-Deferred First)**: Verify withdrawals deplete tax-deferred accounts first, followed by taxable, then tax-free.
- **Test 1.3 (Proportional)**: Verify withdrawals are taken from all account types in exact proportion to their balances.

### Suite 2: RMDs and RRIF Minimum Withdrawals
- **Test 2.1 (US RMD at Age 73+)**: Configure a US household aged 74 with a Traditional IRA. Verify mandatory RMD is calculated and withdrawn first.
- **Test 2.2 (CA RRIF Minimum at Age 71+)**: Configure a CA household aged 71 with an RRSP/RRIF. Verify statutory minimum withdrawal is executed.
- **Test 2.3 (Excess RMD Reinvestment)**: Configure an RMD of $50k and a spending need of $30k. Verify $20k is reinvested into a taxable account with updated cost basis.

### Suite 3: Pension & Life Event Integration
- **Test 3.1 (Pension Income Offset)**: Configure $40k spending need and $25k Social Security pension. Verify net portfolio withdrawal is exactly $15k.
- **Test 3.2 (Active Life Events)**: Add an active expense life event of $10k and an income life event of $5k. Verify total cash requirement adjusts correctly.
- **Test 3.3 (Inactive Life Events)**: Add life events outside the current year/age. Verify they have zero impact on the drawdown calculation.

### Suite 4: Tax Engine Integration & Circularity
- **Test 4.1 (Tax Gross-Up)**: Configure portfolio-paid taxes. Verify the fixed-point iteration successfully increases the gross withdrawal to cover the resulting tax liability.
- **Test 4.2 (OAS Clawback Convergence)**: Configure a Canadian household with high tax-deferred withdrawals and OAS pension. Verify the iteration accurately calculates the OAS clawback and adjusts net withdrawals.
- **Test 4.3 (Pro-Rata Capital Gains)**: Withdraw from a taxable account with 50% unrealized gains. Verify exact pro-rata capital gains are sent to the tax engine.

### Suite 5: Edge Cases & Error Boundaries
- **Test 5.1 (Portfolio Depletion)**: Request a withdrawal exceeding total portfolio balance. Verify accounts clamp to $0, `isDepleted` is true, and no negative balances occur.
- **Test 5.2 (Cost Basis Exceeds Balance)**: Withdraw from a taxable account with market losses. Verify zero capital gains are realized.
- **Test 5.3 (Zero Spending Need)**: Configure zero spending and zero RMDs. Verify accounts remain untouched and output matches initial state.
