# Handoff Report: M1.2 Tax Engine Exploration

## 1. Observation
- **Task Assignment**: `task.md` in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_tax_engine_2` establishes the objective to explore requirements and design for `src/lib/planner/taxEngine.ts` and its unit tests `__tests__/planner/taxEngine.spec.ts`.
- **Domain Types & Schemas**: `src/lib/planner/types.ts` defines Zod schemas and TypeScript types:
  - `AccountSchema` (lines 4-18) includes `type: z.enum(['taxable', 'tax_deferred', 'tax_free'])`, `balance`, `costBasis`, `owner: z.enum(['primary', 'spouse', 'joint'])`.
  - `PensionSchema` (lines 56-72) includes `type: z.enum(['social_security', 'cpp', 'oas', 'defined_benefit'])`.
  - `LifeEventSchema` (lines 75-96) includes `type: z.enum(['expense', 'income'])`.
  - `HouseholdSchema` (lines 110-140) includes `taxJurisdiction: z.enum(['US', 'CA'])`, `stateProvince: z.string()`, `birthYear`, `spouseBirthYear`, `includeSpouse: z.boolean()`.
- **Project Architectural Goals**: `PROJECT.md` (in `.agents/orchestrator/PROJECT.md`, lines 7, 14, 21-24) requires pure TypeScript business logic engines (`taxEngine.ts`) with zero side effects, importing Zod schemas and inferred types from `types.ts`.
- **Scope & Milestones**: `SCOPE.md` (in `.agents/sub_orch_m1_core_domain_1/SCOPE.md`, lines 5-6, 10, 16, 22-24) mandates implementing US/CA progressive tax brackets in `src/lib/planner/taxEngine.ts` and achieving 100% passing test coverage via `npm run test __tests__/planner`.
- **Directory Verification**: `list_dir` on `src/lib/planner` and `__tests__/planner` confirmed that `taxEngine.ts` and `taxEngine.spec.ts` do not currently exist, confirming this is a greenfield design task.

## 2. Logic Chain
1. **Pure Function Requirement**: Since `PROJECT.md` and `SCOPE.md` explicitly mandate pure TypeScript business logic engines with zero side effects, `taxEngine.ts` must not depend on external state, database calls, or store hooks. It must receive a well-defined input object (`TaxInput`) and return a structured output object (`TaxResult`).
2. **Income Source Differentiation**: Based on the account types in `types.ts` (`taxable`, `tax_deferred`, `tax_free`) and pension types (`social_security`, `cpp`, `oas`, `defined_benefit`), the engine must classify income into four distinct buckets before applying tax rules:
   - *Ordinary Income*: Tax-deferred withdrawals (Traditional 401k/IRA, RRSP), defined benefit pensions, CPP, and life event income.
   - *Social Security / OAS*: US Social Security and Canadian Old Age Security, both of which require specialized taxability/clawback calculations depending on net/modified adjusted gross income (MAGI).
   - *Capital Gains*: Withdrawals from taxable accounts exceeding cost basis.
   - *Tax-Free Income*: Roth IRA / TFSA withdrawals and return of principal/cost basis from taxable accounts (must be excluded from all tax and clawback thresholds).
3. **US Jurisdiction Logic**: When `taxJurisdiction === 'US'`:
   - Filing status is determined by `Household.includeSpouse` (Married Filing Jointly vs Single).
   - Standard deductions must incorporate base amounts plus age 65+ additional deductions.
   - Social Security taxable portion must be calculated using the combined income formula (up to 85% taxable).
   - Long-Term Capital Gains (LTCG) must be taxed at 0%, 15%, or 20% brackets depending on taxable ordinary income.
   - State tax handling should use `stateProvince` to apply either zero tax (e.g., TX, FL, NV) or state-specific estimated rates/brackets.
4. **CA Jurisdiction Logic**: When `taxJurisdiction === 'CA'`:
   - Basic Personal Amount (BPA) and age amount credits must be applied.
   - OAS recovery tax (clawback) must be calculated when net income exceeds the federal threshold (e.g., ~$90,997).
   - Capital gains must apply the Canadian inclusion rate (50% inclusion up to $250k, 66.67% above $250k for 2024+ rules), adding the taxable portion directly to ordinary income.
   - Provincial tax brackets must be applied based on `stateProvince` (e.g., ON, BC, AB, QC).
5. **Test Strategy Formulation**: To verify 100% coverage and adherence to `SCOPE.md`, `__tests__/planner/taxEngine.spec.ts` must test each jurisdiction independently across varied income mixes, marital statuses, age brackets (under/over 65), state/provincial selections, and extreme/adversarial bounds (zero income, negative inputs, $10M+ income).

## 3. Caveats
- **Tax Law Evolution**: Tax brackets, standard deductions, BPA, and OAS thresholds change annually. The engine will implement 2024/2025 baseline empirical values as static configurations, which can be adjusted or indexed to inflation by the simulator if needed.
- **Provincial/State Simplification**: Fully implementing all 50 US states and 13 Canadian provinces/territories exact tax codes would be overly complex. A representative set of primary states/provinces (e.g. CA, NY, TX, FL for US; ON, BC, AB, QC for CA) alongside a generic fallback progressive bracket structure for unknown states/provinces is recommended to maintain simplicity and performance.
- **Spousal Income Splitting in Canada**: Canadian tax law allows pension income splitting. For simplicity in a single household simulation step, the engine can accept individual splits in `TaxInput` or apply a simplified household combined calculation based on `includeSpouse`.

## 4. Conclusion
We propose implementing `src/lib/planner/taxEngine.ts` with the following robust, pure functional architecture:

```typescript
import { Household, Account } from './types';

export interface TaxInput {
  jurisdiction: 'US' | 'CA';
  stateProvince: string;
  isMarried: boolean;
  primaryAge: number;
  spouseAge?: number;
  ordinaryIncome: number;
  socialSecurityOasIncome: number;
  capitalGains: number;
  taxFreeIncome: number;
}

export interface TaxResult {
  jurisdiction: 'US' | 'CA';
  totalTax: number;
  federalTax: number;
  stateProvincialTax: number;
  effectiveTaxRate: number;
  marginalTaxRate: number;
  grossIncome: number;
  taxableIncome: number;
  deductionsAndCredits: number;
  socialSecurityOasTaxablePortion: number;
  oasClawback: number;
  taxableCapitalGains: number;
}

export function calculateTaxes(input: TaxInput): TaxResult;
export function calculateUsTaxes(input: TaxInput): TaxResult;
export function calculateCaTaxes(input: TaxInput): TaxResult;
export function calculateUsSocialSecurityTaxable(socialSecurity: number, otherIncome: number, isMarried: boolean): number;
export function calculateCaOasClawback(oasIncome: number, netIncomeBeforeOas: number): number;
export function applyProgressiveBrackets(taxableIncome: number, brackets: Array<{ threshold: number; rate: number }>): { tax: number; marginalRate: number };
```

This design fully satisfies `PROJECT.md` and `SCOPE.md`, handling all income classifications, standard deductions/BPA, Social Security/OAS clawbacks, and capital gains inclusion/LTCG rules.

## 5. Verification Method
- **Implementation Verification**: Inspect `src/lib/planner/taxEngine.ts` to ensure zero side effects, clean Zod type usage, and pure functional exports.
- **Unit Test Execution**: Run `npm run test __tests__/planner` to verify `taxEngine.spec.ts` passes 100% of test cases.
- **TypeScript Compilation**: Run `npx tsc --noEmit` to verify type safety across the newly added engine and tests.
