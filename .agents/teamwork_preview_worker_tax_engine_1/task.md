# Task: M1.2 Tax Engine Implementation (`src/lib/planner/taxEngine.ts` & `__tests__/planner/taxEngine.spec.ts`)

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Objective
Implement `src/lib/planner/taxEngine.ts` as a pure TypeScript business logic engine with zero side effects, and implement its dedicated unit test suite `__tests__/planner/taxEngine.spec.ts` achieving 100% test coverage and full passing verification via `npm run test __tests__/planner`.

## Architectural Specification (Synthesized from Explorers 1, 2, and 3)

### 1. Module Design (`src/lib/planner/taxEngine.ts`)
- **Pure Function Contract**: The tax engine must be entirely pure, free of side effects, external database queries, or store state hooks, optimized for rapid zero-copy Web Worker execution across 1,000 Monte Carlo paths.
- **Interface Contracts**: Must import Zod schemas and inferred types from `src/lib/planner/types.ts` as needed.
- **Data Structures**:
  ```typescript
  export interface TaxInput {
    taxJurisdiction: 'US' | 'CA';
    stateProvince: string;
    includeSpouse: boolean;
    isAge65OrOlder: boolean;
    ordinaryIncome: number; // Pension (non-SS/OAS), Defined Benefit, Income Life Events
    taxDeferredWithdrawals: number; // 401k, Trad IRA, RRSP, RRIF
    capitalGains: number; // Realized capital gains from taxable brokerage
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
  ```

### 2. Core Exported Functions & Logic Pipelines
- `calculateTaxes(input: TaxInput): TaxOutput`: Main delegator branching to `calculateUsTaxes` or `calculateCaTaxes`.
- `calculateUsTaxes(input: TaxInput): TaxOutput`:
  - **Filing Status & Deductions**: Single ($14,600) vs MFJ ($29,200) standard deduction based on `includeSpouse`. Additional elderly deduction ($1,950 Single / $1,550 MFJ) if `isAge65OrOlder`.
  - **Social Security Taxability (Provisional Income Rule)**: Provisional Income = Non-SS Income + 0.5 * SS Benefits. Thresholds: Single ($25k/$34k), MFJ ($32k/$44k). Up to 85% of benefits taxable.
  - **Ordinary Progressive Brackets**: Apply progressive federal brackets (10%, 12%, 22%, 24%, 32%, 35%, 37%) to ordinary taxable base.
  - **Long-Term Capital Gains (LTCG) Stacking**: Stack capital gains + dividends on top of ordinary taxable income and evaluate against progressive LTCG brackets (0%, 15%, 20%).
  - **Simplified State Tax**: 0% for tax-free states (`TX`, `FL`, `NV`, `WA`, `SD`, `WY`, `AK`, `TN`, `NH`), flat 4% on taxable base for others.
- `calculateCaTaxes(input: TaxInput): TaxOutput`:
  - **Basic Personal Amount (BPA)**: ~$15,705 base per person (x2 if `includeSpouse`) plus age amount ($8,790 per person if `isAge65OrOlder`). Applied as a 15% non-refundable federal tax credit reducing federal tax payable.
  - **Capital Gains Inclusion Rate**: 50% inclusion for gains up to $250k, 66.67% inclusion for gains above $250k (2024 rules). Included portion added directly to ordinary income.
  - **Dividend Gross-Up & Tax Credit**: Eligible dividends grossed up by 38% (1.38), Dividend Tax Credit (~15.0198% of grossed-up amount) reduces federal tax payable.
  - **OAS Clawback**: Net income threshold ~$90,997. Clawback is 15% of net income exceeding threshold (capped at total OAS received).
  - **Progressive Federal Brackets**: Apply Canadian progressive federal brackets (15%, 20.5%, 26%, 29%, 33%).
  - **Simplified Provincial Tax**: Estimated at ~40% of federal tax payable.
- `calculateProRataCapitalGain(withdrawal: number, balance: number, costBasis: number): { realizedGain: number; remainingBasis: number; remainingBalance: number }`:
  - Computes pro-rata realized capital gain $W \times \frac{B - C}{B}$, remaining basis, and remaining balance for taxable account withdrawals.

### 3. Comprehensive Unit Test Suite (`__tests__/planner/taxEngine.spec.ts`)
- Must use Jest `describe/it` blocks to achieve 100% test coverage across:
  1. `calculateProgressiveTax` bracket boundaries and marginal rate verification.
  2. `calculateProRataCapitalGain` partial/full withdrawals, cost basis exceeding balance, zero/negative bounds.
  3. `calculateUsTaxes` Single/MFJ deductions, SS provisional income tiers (0%, 50%, 85%), LTCG stacking (0%, 15%, 20%), tax-free states (TX/FL/NV), Roth IRA tax immunity.
  4. `calculateCaTaxes` BPA/Age credits, capital gains inclusion (50% and >$250k at 66.67%), dividend gross-up/DTC, OAS clawback above $90,997, TFSA tax immunity.

## Verification Protocol (You must run and verify these)
1. Run `npx tsc --noEmit` to verify complete type safety.
2. Run `npm run test __tests__/planner` to ensure 100% passing tests across `types.spec.ts` and `taxEngine.spec.ts`.
3. Verify `git status` confirms all changes are strictly local with zero commits pushed to remote git repositories.
4. Produce a self-contained `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_worker_tax_engine_1`) documenting all commands run, passing test logs, and verified evidence.
