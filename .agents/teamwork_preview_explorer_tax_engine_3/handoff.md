# Handoff Report: Tax Engine Exploration & Architecture Design

## 1. Observation
During the exploration of the requirements and design for the Financial Retirement Planner's tax engine (`src/lib/planner/taxEngine.ts`) and its unit tests (`__tests__/planner/taxEngine.spec.ts`), the following facts and structural contracts were directly observed across the workspace:

- **Target Files Status**: Via `list_dir` on `src/lib/planner` and `__tests__/planner`, it was observed that `src/lib/planner/taxEngine.ts` and `__tests__/planner/taxEngine.spec.ts` do not currently exist. `src/lib/planner` contains only `types.ts`, and `__tests__/planner` contains `types.spec.ts` and `adv_types.spec.ts`.
- **Core Domain Types (`src/lib/planner/types.ts`)**: Contains Zod schemas and TypeScript types for `Household`, `Account`, `Spending`, `Pension`, `LifeEvent`, `SimulationConfig`, `SimulationResultsSummary`, and `QuickCheckParams`.
  - `Account` defines `type: z.enum(['taxable', 'tax_deferred', 'tax_free'])`, `balance`, `costBasis`, and `owner: z.enum(['primary', 'spouse', 'joint'])`.
  - `Household` defines `taxJurisdiction: z.enum(['US', 'CA'])`, `stateProvince`, `birthYear`, `retirementAge`, and `includeSpouse: z.boolean().default(false)`.
- **Task Objectives (`task.md`, Lines 6-15)**:
  - "The tax engine must be a pure TypeScript business logic engine implementing progressive tax brackets for US and CA jurisdictions, handling different income types (ordinary income, capital gains, tax-deferred withdrawals vs taxable account capital gains vs tax-free withdrawals)."
  - "Investigate the requirements for US and CA progressive tax calculation, including standard deductions/basic personal amounts, federal brackets, and treatment of capital gains vs ordinary income."
  - "Propose a robust, pure functional architecture for `taxEngine.ts` and a comprehensive test strategy for `taxEngine.spec.ts`."
- **Project Architectural Standards (`PROJECT.md`, `SCOPE.md`, `ARCHITECTURE.md`, `PRD_RETIREMENT_PLANNER.md`)**:
  - `SCOPE.md` (Lines 22-24) mandates: "All engines must import and use Zod schemas and inferred TypeScript types from `types.ts`. Pure functions with zero side effects."
  - `PRD_RETIREMENT_PLANNER.md` (Lines 20, 308) specifies tracking "capital gains inclusion rates and cost basis" for taxable brokerage accounts, and handling "US/CA progressive marginal brackets, capital gains, dividend tax credits".
  - `PROJECT.md` (Line 14) requires core domain engines and unit tests to achieve clean execution and pass 100% of tests.
- **Peer Agent Status**: `teamwork_preview_explorer_tax_engine_1` and `teamwork_preview_explorer_tax_engine_2` were inspected; both initialized their workspaces but have not produced `handoff.md` reports or conflicting designs, making this report the authoritative synthesis and architectural baseline.

## 2. Logic Chain
Based on the direct observations above, the architectural design and test strategy for `taxEngine.ts` are constructed through the following logical deductions:

1. **Strict Pure Functional Contract**: Since `SCOPE.md` requires pure functions with zero side effects and `types.ts` defines immutable domain structures, `taxEngine.ts` must export stateless, pure functions (`calculateTaxes`, `calculateUsTaxes`, `calculateCaTaxes`, `calculateProRataCapitalGain`). It must not maintain internal class state or perform external I/O or database calls.
2. **Standardized Input/Output Interfaces**: To decouple the tax engine from raw component state while adhering to `Household` and `Account` definitions, a dedicated `TaxInput` and `TaxOutput` interface must be defined. `TaxInput` will aggregate income streams by tax treatment (ordinary, tax-deferred, capital gains, eligible dividends, SS/OAS, tax-free) along with household filing parameters (`taxJurisdiction`, `stateProvince`, `includeSpouse`, `isAge65OrOlder`).
3. **US Tax Mechanics Integration**:
   - **Filing Status & Deductions**: `includeSpouse` directly maps to Single vs. Married Filing Jointly (MFJ). Standard deductions ($14,600 Single / $29,200 MFJ for 2024/2025 baseline) must be subtracted from Adjusted Gross Income (AGI). An additional standard deduction applies if `isAge65OrOlder` is true.
   - **Social Security Taxability**: Social Security income cannot be flatly taxed. The engine must compute Provisional Income (Modified AGI + 50% of SS benefits) to determine whether 0%, 50%, or 85% of Social Security benefits are included in ordinary taxable income.
   - **Capital Gains Stacking**: Long-Term Capital Gains (LTCG) from taxable brokerage accounts must be stacked on top of ordinary taxable income and evaluated against US LTCG brackets (0%, 15%, 20%).
4. **CA Tax Mechanics Integration**:
   - **Basic Personal Amount (BPA)**: Instead of a standard deduction, Canada applies a federal Basic Personal Amount (~$15,705 baseline) as a non-refundable tax credit or direct taxable income offset.
   - **Capital Gains Inclusion Rate**: Realized capital gains from non-registered taxable accounts must have an inclusion rate applied (50% baseline, with support for the 2024 tiered 66.67% rule above $250k). The included portion is added directly to ordinary income.
   - **Dividend Tax Credit (DTC)**: Canadian eligible dividends must be grossed up (e.g., 38%) and receive the federal dividend tax credit (~15.0198% of grossed-up amount) to reflect empirical after-tax retention.
5. **Pro-Rata Basis Recovery**: When withdrawing from a `taxable` brokerage account during drawdown simulation, the realized capital gain must be calculated pro-rata based on the account's current balance and `costBasis` ($W \times \frac{B - C}{B}$). A dedicated pure helper `calculateProRataCapitalGain` is required for seamless integration with `drawdownEngine.ts`.
6. **Robust Test Strategy**: To guarantee 100% passing test coverage (`npm run test __tests__/planner`), `taxEngine.spec.ts` must validate progressive bracket boundaries, single vs. spousal deductions, US Social Security taxability tiers, CA capital gains inclusion rates, Roth/TFSA tax-free immunity, pro-rata basis calculations, and zero/negative income bounds.

## 3. Caveats
- **State/Provincial Tax Simplification**: While federal tax brackets are modeled with precise progressive tiers, exact county/municipal or complex state-specific deductions across all 50 US states and 13 CA provinces/territories would introduce unnecessary bloat. It is assumed that a simplified state/provincial tax tier or flat blended rate mapped by `stateProvince` satisfies the simulation requirements without compromising architectural elegance.
- **Future Tax Law Sunsets**: Tax brackets and standard deductions reflect the 2024/2025 empirical baseline. Potential legislative sunsets (e.g., TCJA expiration in 2026) are assumed to be configurable via static table updates rather than complex time-dependent logic inside the pure engine.
- **No Direct Implementation**: As an explorer agent operating under read-only constraints, no files were created in `src/lib/planner/` or `__tests__/planner/`. The proposed architecture and code structures in this report are designed for immediate adoption by the subsequent implementer agent.

## 4. Conclusion
The `src/lib/planner/taxEngine.ts` module must be implemented as a pure TypeScript business logic engine featuring immutable configuration tables and stateless functions. 

### Proposed Architectural Specifications (`src/lib/planner/taxEngine.ts`)

```typescript
import { Household, Account } from './types';

export interface TaxInput {
  taxJurisdiction: 'US' | 'CA';
  stateProvince: string;
  includeSpouse: boolean;
  isAge65OrOlder: boolean;
  ordinaryIncome: number; // Pension, Defined Benefit, Income Life Events
  taxDeferredWithdrawals: number; // 401k, Trad IRA, RRSP, RRIF
  capitalGains: number; // Realized gains from taxable brokerage
  eligibleDividends?: number; // CA eligible dividends / US qualified dividends
  socialSecurityOasIncome: number; // US Social Security / CA OAS
  taxFreeWithdrawals: number; // Roth IRA / TFSA (0% tax)
}

export interface TaxOutput {
  taxJurisdiction: 'US' | 'CA';
  totalTax: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  federalTax: number;
  stateProvincialTax: number;
  taxableIncome: number;
  deductionsAndCredits: number;
  taxableSocialSecurityOas: number;
  taxableCapitalGains: number;
}

interface TaxBracket {
  threshold: number;
  rate: number;
}

// Static Immutable Bracket Configurations (2024/2025 Baseline)
const US_FEDERAL_BRACKETS_SINGLE: TaxBracket[] = [
  { threshold: 609350, rate: 0.37 },
  { threshold: 243725, rate: 0.35 },
  { threshold: 191950, rate: 0.32 },
  { threshold: 100525, rate: 0.24 },
  { threshold: 47150, rate: 0.22 },
  { threshold: 11600, rate: 0.12 },
  { threshold: 0, rate: 0.10 },
];

const US_FEDERAL_BRACKETS_MFJ: TaxBracket[] = [
  { threshold: 731200, rate: 0.37 },
  { threshold: 487450, rate: 0.35 },
  { threshold: 383900, rate: 0.32 },
  { threshold: 201050, rate: 0.24 },
  { threshold: 94300, rate: 0.22 },
  { threshold: 23200, rate: 0.12 },
  { threshold: 0, rate: 0.10 },
];

const CA_FEDERAL_BRACKETS: TaxBracket[] = [
  { threshold: 246752, rate: 0.33 },
  { threshold: 173205, rate: 0.29 },
  { threshold: 111733, rate: 0.26 },
  { threshold: 55867, rate: 0.205 },
  { threshold: 0, rate: 0.15 },
];

/**
 * Calculates progressive tax given taxable income and applicable brackets.
 */
export function calculateProgressiveTax(taxableIncome: number, brackets: TaxBracket[]): { tax: number; marginalRate: number } {
  if (taxableIncome <= 0) return { tax: 0, marginalRate: 0 };
  let tax = 0;
  let remainingIncome = taxableIncome;
  let marginalRate = brackets[brackets.length - 1].rate;

  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i];
    if (taxableIncome > bracket.threshold) {
      if (taxableIncome === remainingIncome) {
        marginalRate = bracket.rate;
      }
      const taxableAtThisRate = remainingIncome - bracket.threshold;
      tax += taxableAtThisRate * bracket.rate;
      remainingIncome = bracket.threshold;
    }
  }
  return { tax, marginalRate };
}

/**
 * Computes pro-rata realized capital gain and remaining basis for taxable account withdrawals.
 */
export function calculateProRataCapitalGain(withdrawal: number, balance: number, costBasis: number): { realizedGain: number; remainingBasis: number; remainingBalance: number } {
  if (withdrawal <= 0 || balance <= 0) return { realizedGain: 0, remainingBasis: costBasis, remainingBalance: balance };
  const cappedWithdrawal = Math.min(withdrawal, balance);
  const effectiveBasis = Math.min(costBasis, balance);
  const gainRatio = Math.max(0, (balance - effectiveBasis) / balance);
  const realizedGain = cappedWithdrawal * gainRatio;
  const basisWithdrawn = cappedWithdrawal - realizedGain;
  const remainingBasis = Math.max(0, costBasis - basisWithdrawn);
  const remainingBalance = Math.max(0, balance - cappedWithdrawal);

  return { realizedGain, remainingBasis, remainingBalance };
}

/**
 * US Tax Calculation delegator.
 */
export function calculateUsTaxes(input: TaxInput): TaxOutput {
  const standardDeduction = input.includeSpouse ? 29200 : 14600;
  const elderlyDeduction = input.isAge65OrOlder ? (input.includeSpouse ? 1550 : 1950) : 0;
  const totalDeductions = standardDeduction + elderlyDeduction;

  // Social Security Taxability (Provisional Income Rule)
  const nonSsIncome = input.ordinaryIncome + input.taxDeferredWithdrawals + input.capitalGains + (input.eligibleDividends || 0);
  const provisionalIncome = nonSsIncome + 0.5 * input.socialSecurityOasIncome;
  let taxableSs = 0;
  const base1 = input.includeSpouse ? 32000 : 25000;
  const base2 = input.includeSpouse ? 44000 : 34000;

  if (provisionalIncome > base2) {
    taxableSs = Math.min(0.85 * input.socialSecurityOasIncome, 0.5 * (base2 - base1) + 0.85 * (provisionalIncome - base2));
  } else if (provisionalIncome > base1) {
    taxableSs = Math.min(0.5 * input.socialSecurityOasIncome, 0.5 * (provisionalIncome - base1));
  }

  const ordinaryTaxableBase = Math.max(0, input.ordinaryIncome + input.taxDeferredWithdrawals + taxableSs - totalDeductions);
  const brackets = input.includeSpouse ? US_FEDERAL_BRACKETS_MFJ : US_FEDERAL_BRACKETS_SINGLE;
  const { tax: federalOrdinaryTax, marginalRate: ordinaryMarginal } = calculateProgressiveTax(ordinaryTaxableBase, brackets);

  // LTCG Tax (0%, 15%, 20% stacked on ordinary taxable base)
  const ltcgIncome = input.capitalGains + (input.eligibleDividends || 0);
  let ltcgTax = 0;
  let ltcgMarginal = 0;
  if (ltcgIncome > 0) {
    const ltcgBracket1 = input.includeSpouse ? 94050 : 47025;
    const ltcgBracket2 = input.includeSpouse ? 583750 : 518900;
    const totalTaxable = ordinaryTaxableBase + ltcgIncome;

    if (totalTaxable > ltcgBracket2) {
      const taxedAt20 = Math.min(ltcgIncome, totalTaxable - ltcgBracket2);
      const taxedAt15 = Math.max(0, Math.min(ltcgIncome - taxedAt20, ltcgBracket2 - ltcgBracket1));
      ltcgTax = taxedAt20 * 0.20 + taxedAt15 * 0.15;
      ltcgMarginal = 0.20;
    } else if (totalTaxable > ltcgBracket1) {
      const taxedAt15 = Math.min(ltcgIncome, totalTaxable - ltcgBracket1);
      ltcgTax = taxedAt15 * 0.15;
      ltcgMarginal = 0.15;
    }
  }

  const federalTax = federalOrdinaryTax + ltcgTax;
  // Simplified state tax: flat 4% on taxable base if state is not tax-free
  const noTaxStates = ['TX', 'FL', 'NV', 'WA', 'SD', 'WY', 'AK', 'TN', 'NH'];
  const stateProvincialTax = noTaxStates.includes(input.stateProvince.toUpperCase()) ? 0 : ordinaryTaxableBase * 0.04;

  const totalTax = federalTax + stateProvincialTax;
  const totalIncome = nonSsIncome + input.socialSecurityOasIncome + input.taxFreeWithdrawals;
  const effectiveTaxRate = totalIncome > 0 ? totalTax / totalIncome : 0;
  const marginalTaxRate = Math.max(ordinaryMarginal, ltcgMarginal);

  return {
    taxJurisdiction: 'US',
    totalTax,
    effectiveTaxRate,
    marginalTaxRate,
    federalTax,
    stateProvincialTax,
    taxableIncome: ordinaryTaxableBase + ltcgIncome,
    deductionsAndCredits: totalDeductions,
    taxableSocialSecurityOas: taxableSs,
    taxableCapitalGains: ltcgIncome,
  };
}

/**
 * CA Tax Calculation delegator.
 */
export function calculateCaTaxes(input: TaxInput): TaxOutput {
  const basicPersonalAmount = 15705 * (input.includeSpouse ? 2 : 1);
  const ageAmount = input.isAge65OrOlder ? 8790 * (input.includeSpouse ? 2 : 1) : 0;
  const totalCreditsBase = basicPersonalAmount + ageAmount;
  const nonRefundableCredits = totalCreditsBase * 0.15; // 15% federal credit

  // Capital gains inclusion rate (50% baseline, 66.67% above $250k)
  let taxableCapGains = 0;
  if (input.capitalGains > 250000) {
    taxableCapGains = 250000 * 0.5 + (input.capitalGains - 250000) * (2 / 3);
  } else {
    taxableCapGains = input.capitalGains * 0.5;
  }

  // Dividend Tax Credit (Eligible dividends grossed up by 38%, 15.0198% credit)
  const grossedUpDividends = (input.eligibleDividends || 0) * 1.38;
  const dividendTaxCredit = grossedUpDividends * 0.150198;

  // OAS Clawback threshold (~$90,997)
  const netIncomeBeforeOasClawback = input.ordinaryIncome + input.taxDeferredWithdrawals + taxableCapGains + grossedUpDividends + input.socialSecurityOasIncome;
  let oasClawback = 0;
  if (input.socialSecurityOasIncome > 0 && netIncomeBeforeOasClawback > 90997) {
    oasClawback = Math.min(input.socialSecurityOasIncome, (netIncomeBeforeOasClawback - 90997) * 0.15);
  }
  const netOasIncome = input.socialSecurityOasIncome - oasClawback;

  const taxableIncome = Math.max(0, input.ordinaryIncome + input.taxDeferredWithdrawals + taxableCapGains + grossedUpDividends + netOasIncome);
  const { tax: rawFederalTax, marginalRate } = calculateProgressiveTax(taxableIncome, CA_FEDERAL_BRACKETS);

  const federalTax = Math.max(0, rawFederalTax - nonRefundableCredits - dividendTaxCredit);
  // Simplified provincial tax: ~40% of federal tax or blended progressive rate
  const stateProvincialTax = federalTax * 0.40;

  const totalTax = federalTax + stateProvincialTax + oasClawback;
  const totalIncome = input.ordinaryIncome + input.taxDeferredWithdrawals + input.capitalGains + (input.eligibleDividends || 0) + input.socialSecurityOasIncome + input.taxFreeWithdrawals;
  const effectiveTaxRate = totalIncome > 0 ? totalTax / totalIncome : 0;

  return {
    taxJurisdiction: 'CA',
    totalTax,
    effectiveTaxRate,
    marginalTaxRate,
    federalTax,
    stateProvincialTax,
    taxableIncome,
    deductionsAndCredits: totalCreditsBase,
    taxableSocialSecurityOas: netOasIncome,
    taxableCapitalGains: taxableCapGains,
  };
}

/**
 * Main tax calculation entry point.
 */
export function calculateTaxes(input: TaxInput): TaxOutput {
  if (input.taxJurisdiction === 'US') {
    return calculateUsTaxes(input);
  } else {
    return calculateCaTaxes(input);
  }
}
```

### Comprehensive Unit Test Strategy (`__tests__/planner/taxEngine.spec.ts`)
The test suite must utilize Jest/Describe blocks covering the following test categories:
1. **`calculateProgressiveTax` Unit Tests**: Test income at exact bracket thresholds, zero income, and top bracket marginal rate verification.
2. **`calculateProRataCapitalGain` Unit Tests**: Test partial withdrawals, full withdrawals, cost basis exceeding balance, and zero withdrawal bounds.
3. **`calculateUsTaxes` Scenarios**:
   - Single vs MFJ standard deduction verification.
   - Social Security provisional income tiers (0%, 50%, 85% taxable).
   - Long-Term Capital Gains stacking at 0%, 15%, and 20% rates.
   - Tax-free state verification (TX/FL/NV = $0 state tax).
   - Roth IRA withdrawal tax immunity ($0 tax impact).
4. **`calculateCaTaxes` Scenarios**:
   - Basic Personal Amount and Age Amount credit offsets.
   - Capital gains inclusion rate at 50% and >$250k tiered 66.67%.
   - Eligible dividend gross-up and Dividend Tax Credit reduction.
   - OAS clawback calculation above $90,997 threshold.
   - TFSA withdrawal tax immunity ($0 tax impact).

## 5. Verification Method
To independently verify the success and correctness of the tax engine implementation once executed by the implementer agent, the following verification protocol must be followed:

1. **Verify Code Existence & Linting**:
   - Inspect `src/lib/planner/taxEngine.ts` and `__tests__/planner/taxEngine.spec.ts` via `view_file`.
   - Ensure zero TypeScript compilation errors or circular dependencies exist.
2. **Execute Unit Test Suite**:
   - Run the dedicated test command:
     ```bash
     npm run test __tests__/planner
     ```
   - Verify that 100% of the unit tests pass successfully with zero failures across both `types.spec.ts` and `taxEngine.spec.ts`.
3. **Verify Git Integrity**:
   - Run `git status` to confirm all file changes are strictly local to the working directory with zero commits pushed to remote repositories.
