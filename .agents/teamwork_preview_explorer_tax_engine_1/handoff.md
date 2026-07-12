# Handoff Report: M1.2 Tax Engine Exploration & Design

## 1. Observation
- **Task Mandate**: `task.md` in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_tax_engine_1` mandates exploring the requirements and design for `src/lib/planner/taxEngine.ts` and its unit tests `__tests__/planner/taxEngine.spec.ts`.
- **Domain Types & Schemas**: `src/lib/planner/types.ts` defines `HouseholdSchema` (requiring `taxJurisdiction: z.enum(['US', 'CA'])`, `includeSpouse`, `stateProvince`), `AccountSchema` (`type: z.enum(['taxable', 'tax_deferred', 'tax_free'])`, `balance`, `costBasis`), and `PensionSchema`.
- **Project Scope & Architecture**:
  - `docs/PRD_RETIREMENT_PLANNER.md` (lines 305-309) mandates: *"All tax calculations (US/CA progressive marginal brackets, capital gains, dividend tax credits)... reside in pure, standalone TypeScript modules under `src/lib/planner/`."*
  - `.agents/orchestrator/PROJECT.md` (lines 7, 14, 21-24) defines pure business logic engines with zero side effects.
  - `.agents/sub_orch_m1_core_domain_1/SCOPE.md` (lines 6, 16, 22-24) mandates `src/lib/planner/taxEngine.ts` to implement US/CA progressive tax brackets as pure functions and `__tests__/planner/taxEngine.spec.ts` to achieve 100% test coverage.
- **Existing File Baseline**: `list_dir` on `src/lib/planner` confirms only `types.ts` currently exists, and `__tests__/planner` confirms only `types.spec.ts` and `adv_types.spec.ts` exist.

## 2. Logic Chain
- **Requirement for Pure Functional Boundaries**: Since the tax engine will be invoked by `drawdownEngine.ts` and `simulator.ts` across 1,000 parallel Monte Carlo paths in a Web Worker, `taxEngine.ts` must be completely pure, free of side effects, and optimized for rapid execution without external dependencies or state mutations.
- **Support for Distinct Tax Jurisdictions & Structures**:
  - `taxJurisdiction` in `Household` is strictly `'US' | 'CA'`. Therefore, the tax engine must branch into two distinct calculation pipelines (`calculateUSTax` and `calculateCATax`) under a unified `calculateTax` entry point.
  - **Filing Status Determination**: In `types.ts`, `Household` defines `includeSpouse`, `spouseBirthYear`, and `spouseRetirementAge`. The engine should accept `filingStatus: 'single' | 'joint'` derived from whether a spouse is included in the household.
- **US Jurisdiction Logic**:
  - **Standard Deduction**: Requires baseline standard deductions (e.g., $15,000 for Single, $30,000 for Married Filing Jointly/MFJ) to subtract from ordinary income before applying brackets.
  - **Progressive Ordinary Income Brackets**: Must implement progressive marginal rates (e.g., 10%, 12%, 22%, 24%, 32%, 35%, 37%) applied to taxable ordinary income (e.g., tax-deferred 401k/IRA withdrawals, pensions).
  - **Long-Term Capital Gains (LTCG) Stacking**: Capital gains from taxable accounts are stacked on top of ordinary income and taxed at progressive LTCG brackets (0%, 15%, 20%).
  - **Social Security Taxability**: In the US, Social Security benefits are not fully taxable. The engine needs a provisional income calculation: $\text{Provisional Income} = \text{Non-SS Income} + 0.5 \times \text{SS Benefits}$. Based on thresholds ($25k/$34k Single, $32k/$44k Joint), 0%, 50%, or up to 85% of benefits are included in ordinary taxable income.
- **CA Jurisdiction Logic**:
  - **Basic Personal Amount (BPA)**: Canada utilizes a non-refundable tax credit for the Basic Personal Amount (e.g., ~$15,705), which reduces tax payable at the lowest bracket rate (15%).
  - **Progressive Federal Brackets**: Must implement Canadian progressive marginal rates (e.g., 15%, 20.5%, 26%, 29%, 33%).
  - **Capital Gains Inclusion Rate**: Canada does not have separate tax brackets for capital gains; instead, an inclusion rate (standard 50%, or 66.67% above $250k under 2024 rules) is applied to realized capital gains, and the resulting amount is added directly to ordinary taxable income.
  - **Dividend Gross-Up & Tax Credit**: For Canadian eligible dividends, the amount is grossed up (e.g., 38% / 1.38), added to taxable income, and then offset by the Dividend Tax Credit (DTC) (e.g., ~15.0198% of the grossed-up amount).
- **Proportional Cost Basis Relief Helper**: When withdrawing $W$ from a taxable brokerage account with balance $B$ and cost basis $C$, the drawdown engine requires a pure helper `calculateRealizedCapitalGain` to compute the exact realized gain $W \times (1 - C / B)$, the principal return $W \times (C / B)$, and the remaining cost basis $C - W \times (C / B)$.
- **Testing Strategy**: To guarantee 100% test coverage and ensure zero runtime errors during Web Worker simulation, `__tests__/planner/taxEngine.spec.ts` must use Jest `describe/it` blocks covering standard deductions, progressive brackets, LTCG stacking, SS provisional income thresholds, CA BPA credits, CA capital gains inclusion, dividend tax credits, and edge cases (negative/zero income, extreme wealth brackets).

## 3. Caveats
- **State/Provincial Tax Variations**: While `stateProvince` is captured in `Household`, implementing 50 US states and 13 Canadian provinces/territories with exact local tax brackets would add massive complexity and potential performance drag to a 1,000-path Monte Carlo simulation. *Recommendation*: Keep the baseline engine focused on precise Federal progressive brackets and provide an optional estimated state/provincial flat tax rate parameter (e.g., 5% or 10%) or simplified tier structure for state/provincial taxes.
- **Future Tax Law Changes**: Tax brackets and standard deductions index to inflation annually and change with legislation (e.g., TCJA expiration in 2026). *Recommendation*: Design the tax brackets and standard deductions as structured, configurable constant arrays/objects at the top of `taxEngine.ts` so they can be easily updated or overridden by `SimulationConfig` if needed.

## 4. Conclusion
We propose the following complete, pure functional architecture and interface contracts for `src/lib/planner/taxEngine.ts`:

```typescript
// Proposed Interface Contracts for src/lib/planner/taxEngine.ts

export interface TaxInput {
  jurisdiction: 'US' | 'CA';
  filingStatus: 'single' | 'joint';
  ordinaryIncome: number; // Tax-deferred withdrawals, pensions (non-SS/CPP/OAS), other income
  capitalGains: number; // Realized capital gains from taxable accounts
  socialSecurityBenefits?: number; // US Social Security (subject to provisional income rules)
  eligibleDividends?: number; // CA eligible dividends (subject to gross-up and DTC)
  stateProvince?: string; // State/province identifier
  stateTaxRateOverride?: number; // Optional simplified state/provincial tax rate (e.g., 0.05 for 5%)
  customDeduction?: number; // Override for standard deduction / BPA
}

export interface TaxResult {
  taxJurisdiction: 'US' | 'CA';
  filingStatus: 'single' | 'joint';
  totalTax: number; // Combined federal (+ optional state) tax payable
  effectiveTaxRate: number; // totalTax / totalGrossIncome
  breakdown: {
    taxableOrdinaryIncome: number; // After deductions / BPA / SS inclusion / Dividend gross-up
    ordinaryIncomeTax: number;
    taxableCapitalGains: number; // US LTCG amount or CA 50% inclusion amount
    capitalGainsTax: number; // US LTCG tax or CA tax attributable to gains inclusion
    socialSecurityTaxableAmount?: number; // US only
    dividendTaxCredit?: number; // CA only
    standardDeductionOrBPA: number;
    stateTax: number;
  };
}

export interface RealizedGainResult {
  withdrawalAmount: number;
  principal: number;
  capitalGain: number;
  remainingCostBasis: number;
  remainingBalance: number;
}

// Core Exported Functions
export function calculateTax(input: TaxInput): TaxResult;
export function calculateUSTax(input: TaxInput): TaxResult;
export function calculateCATax(input: TaxInput): TaxResult;
export function calculateRealizedCapitalGain(
  withdrawal: number,
  currentBalance: number,
  costBasis: number
): RealizedGainResult;
```

## 5. Verification Method
To independently verify the implementation of `taxEngine.ts` and its test suite once implemented by the worker agent:
1. **TypeScript Compilation & Linting**:
   - Run `npx tsc --noEmit` to confirm complete type safety and strict adherence to Zod/TypeScript definitions.
   - Run `npx eslint src/lib/planner/taxEngine.ts __tests__/planner/taxEngine.spec.ts` to ensure clean code quality.
2. **Unit Testing & Coverage**:
   - Run `npm run test __tests__/planner/taxEngine.spec.ts` to execute the dedicated test suite.
   - Run `npm run test __tests__/planner/taxEngine.spec.ts -- --coverage` to verify 100% statement, branch, function, and line coverage.
3. **Invalidation Conditions**:
   - Any side effect or external state mutation within `taxEngine.ts` invalidates the pure functional requirement.
   - Failure to correctly calculate US Social Security provisional income tiers or Canadian capital gains inclusion rates invalidates the domain accuracy requirement.
