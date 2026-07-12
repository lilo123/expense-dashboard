# Handoff Report: M1.3 Pension Engine Exploration

## 1. Observation

### Task Objective & Constraints
- **Task Definition**: Observed in `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_pension_engine_3/task.md` (Lines 1-20).
- **Objective**: Explore requirements and design for `src/lib/planner/pensionEngine.ts` and its unit tests `__tests__/planner/pensionEngine.spec.ts`.
- **Target Pension Systems**:
  - **US Social Security**: Full/Normal Retirement Age (NRA) based on birth year, early claiming penalties (down to age 62), and delayed retirement credits (up to age 70).
  - **Canadian CPP**: Standard start age 65, early claiming reduction (0.6% per month down to age 60), and delayed claiming increase (0.7% per month up to age 70).
  - **Canadian OAS**: Standard start age 65, delayed claiming increase (0.6% per month up to age 70), and OAS clawback thresholds (~$90,997 net income base).
  - **Defined Benefit**: Flat or inflation-adjusted base amounts starting at a specified `startAge`.

### Project Architectural Standards & Contracts
- **`PROJECT.md`** (Lines 7, 14, 21-24, 35) mandates pure TypeScript business logic engines with Zod validation schemas in `src/lib/planner/types.ts`.
- **`SCOPE.md`** (Lines 5-7, 22-24) establishes the contract: "All engines must import and use Zod schemas and inferred TypeScript types from `types.ts`. Pure functions with zero side effects."

### Type Definitions in `src/lib/planner/types.ts`
- **`PensionSchema`** (Lines 56-72) defines the domain type `Pension`:
  ```typescript
  export const PensionSchema = z.object({
    id: z.string().min(1, "Pension ID is required"),
    owner: z.enum(['primary', 'spouse']),
    type: z.enum(['social_security', 'cpp', 'oas', 'defined_benefit']),
    baseAmount: z.number().nonnegative("Base amount must be non-negative"),
    startAge: z.number().min(50).max(80, "Start age must be between 50 and 80"),
    inflationAdjusted: z.boolean(),
  }).refine(data => {
    if (data.type === 'social_security') {
      return data.startAge >= 62;
    }
    return true;
  }, {
    message: "Social Security startAge cannot be less than 62",
    path: ['startAge'],
  });
  export type Pension = z.infer<typeof PensionSchema>;
  ```
- **`HouseholdSchema`** (Lines 110-140) contains `pensions: z.array(PensionSchema).optional()`, `birthYear: z.number().int().min(1900).max(2100)`, `spouseBirthYear: z.number().int().min(1900).max(2100).optional()`, and `taxJurisdiction: z.enum(['US', 'CA'])`.

### Existing Engine Precedent (`src/lib/planner/taxEngine.ts`)
- Lines 1-33 define explicit input/output interfaces (`TaxInput`, `TaxOutput`, `TaxBracket`) and import `Account`, `Household` from `./types`.
- Lines 37-372 implement highly modular, pure functions (`getTaxJurisdiction`, `calculateProgressiveTax`, `calculateStackedLtcgTax`, `calculateProRataCapitalGain`, `calculateUsTaxes`, `calculateCaTaxes`, `calculateTaxes`).
- Lines 303-311 in `calculateCaTaxes` define the existing OAS clawback precedent:
  ```typescript
  const oasClawback = Math.min(input.socialSecurityOasIncome, Math.max(0, (netIncome - 90997) * 0.15));
  const taxableSocialSecurityOas = Math.max(0, input.socialSecurityOasIncome - oasClawback);
  ```

### Existing Unit Test Precedent (`__tests__/planner/taxEngine.spec.ts`)
- Lines 1-348 utilize Jest (`describe`, `it`, `expect`) to test every helper function independently across edge cases, negative/zero bounds, different filing statuses, and boundary thresholds.

### Project Scripts
- `package.json` (Lines 5-13) specifies `"test": "jest"` and `"build": "next build"`.

---

## 2. Logic Chain

### 1. Purity & Input/Output Interface Decoupling
- *Observation Reference*: `SCOPE.md` lines 22-24 and `taxEngine.ts` lines 1-33.
- *Inference*: To maintain zero side effects and seamless interoperability with the simulation worker and tax engine, `pensionEngine.ts` must define explicit, decoupled input and output interfaces (`PensionInput` and `PensionOutput`). `PensionInput` must supply the individual `Pension` object, the owner's `birthYear`, `currentAge`, `yearsElapsed` (for inflation indexing), `inflationRate`, and an optional `netIncomeForOas` (to evaluate OAS clawback).

### 2. US Social Security Claim-Age Adjustment Mechanics
- *Observation Reference*: `task.md` lines 13-14 and `src/lib/planner/types.ts` lines 56-72.
- *Inference*: Social Security NRA varies strictly by birth year (from age 65 for <=1937 to age 67 for >=1960). A pure helper `calculateSocialSecurityNra(birthYear: number)` must determine the exact NRA in months. Early claiming penalties apply down to age 62 (5/9 of 1% per month for the first 36 months early; 5/12 of 1% per month for months 37 to 60 early). Delayed retirement credits apply up to age 70 (2/3 of 1% per month for birth years >= 1943). A dedicated pure function `calculateSocialSecurityAdjustment(birthYear: number, startAge: number)` must compute this adjustment factor precisely based on month deltas.

### 3. Canadian CPP Claim-Age Adjustment Mechanics
- *Observation Reference*: `task.md` line 15.
- *Inference*: CPP has a standard start age of 65 (780 months). Early claiming (ages 60 to 65) incurs a 0.6% monthly reduction (up to 36% at 60). Delayed claiming (ages 65 to 70) provides a 0.7% monthly increase (up to 42% at 70). A pure helper `calculateCppAdjustment(startAge: number)` must evaluate `startAge * 12 - 780` to derive the adjustment factor.

### 4. Canadian OAS Claim-Age Adjustment & Clawback Mechanics
- *Observation Reference*: `task.md` line 16 and `taxEngine.ts` lines 303-310.
- *Inference*: OAS standard start age is 65 (claiming before 65 is disallowed/0 benefit). Delayed claiming (ages 65 to 70) yields a 0.6% monthly increase (up to 36% at 70). A pure helper `calculateOasAdjustment(startAge: number)` must evaluate `Math.max(0, startAge * 12 - 780)` to derive the adjustment factor. Furthermore, `calculateOasClawback(grossOas: number, netIncome: number)` must enforce the 15% recovery tax on net income exceeding $90,997, capped at `grossOas`.

### 5. Defined Benefit & Inflation Adjustments
- *Observation Reference*: `task.md` line 17 and `types.ts` lines 60-62.
- *Inference*: For Defined Benefit, the adjustment factor is fixed at 1.0. For all pension types, if `pension.inflationAdjusted` is true, the gross base amount must be multiplied by `Math.pow(1 + inflationRate, yearsElapsed)`. If `currentAge < pension.startAge`, the engine must immediately return 0 for gross and net amounts.

### 6. Household-Level Aggregation
- *Observation Reference*: `taxEngine.ts` lines 365-372 and `types.ts` lines 110-140.
- *Inference*: A top-level delegator `calculateAllPensions(household: Household, currentYear: number, inflationRate: number, netIncomeForOas?: number): PensionOutput[]` must iterate over `household.pensions`, correctly bind `birthYear` (matching `owner === 'spouse'` to `household.spouseBirthYear`), calculate `currentAge` and `yearsElapsed`, and invoke the individual pension calculation.

### 7. Rigorous Test Suite Strategy
- *Observation Reference*: `__tests__/planner/taxEngine.spec.ts`.
- *Inference*: `__tests__/planner/pensionEngine.spec.ts` must achieve 100% statement/branch coverage by structuring tests into 6 distinct `describe` blocks covering: (1) SS NRA calculations across all birth year tiers, (2) SS adjustment factors (early claim at 62, exact NRA, delayed claim at 70), (3) CPP adjustment factors (early at 60, standard at 65, delayed at 70), (4) OAS adjustment factors and clawback thresholds, (5) DB pensions and inflation compounding, and (6) Household aggregation with primary and spouse pensions.

---

## 3. Caveats

- **US Social Security NRA Pre-1943 Delayed Credits**: The statutory delayed retirement credit for birth years prior to 1943 was lower than 2/3 of 1% per month. However, since the simulation targets retirement planning for living individuals (birth year 1943 reached age 70 in 2013), applying 2/3 of 1% per month for all delayed claims is the standard, practical domain assumption.
- **OAS Inflation Indexing of Clawback Threshold**: The statutory OAS clawback threshold ($90,997) is indexed to inflation annually in Canadian tax law. In accordance with `taxEngine.ts` precedent, the threshold is modeled as a constant $90,997 base against real/current net income.
- **Monthly vs Annual Payout Resolution**: The Zod schemas specify `baseAmount` as a single number (typically interpreted as annual in simulation engines). The monthly adjustment percentages (e.g., 0.6% per month) are applied to determine the annualized adjustment factor, preserving unit agnosticism (works identically whether `baseAmount` is monthly or annual).

---

## 4. Conclusion

### Proposed Architecture for `src/lib/planner/pensionEngine.ts`

```typescript
import { Pension, Household } from './types';

export interface PensionInput {
  pension: Pension;
  birthYear: number;
  currentAge: number;
  yearsElapsed: number;
  inflationRate: number;
  netIncomeForOas?: number;
}

export interface PensionOutput {
  pensionId: string;
  type: Pension['type'];
  owner: Pension['owner'];
  grossAmount: number;
  clawbackAmount: number;
  netAmount: number;
  claimAgeAdjustmentFactor: number;
}

/**
 * Calculates the exact Social Security Normal Retirement Age (NRA) in years, months, and total months.
 */
export function calculateSocialSecurityNra(birthYear: number): { years: number; months: number; totalMonths: number } {
  let years = 66;
  let months = 0;

  if (birthYear <= 1937) {
    years = 65;
    months = 0;
  } else if (birthYear >= 1938 && birthYear <= 1942) {
    years = 65;
    months = (birthYear - 1937) * 2;
  } else if (birthYear >= 1943 && birthYear <= 1954) {
    years = 66;
    months = 0;
  } else if (birthYear >= 1955 && birthYear <= 1959) {
    years = 66;
    months = (birthYear - 1954) * 2;
  } else {
    years = 67;
    months = 0;
  }

  return { years, months, totalMonths: years * 12 + months };
}

/**
 * Calculates the Social Security claim-age adjustment factor (early claim penalty / delayed retirement credit).
 */
export function calculateSocialSecurityAdjustment(birthYear: number, startAge: number): number {
  const nra = calculateSocialSecurityNra(birthYear);
  const startMonths = Math.round(startAge * 12);
  const delta = startMonths - nra.totalMonths;

  if (delta < 0) {
    const earlyMonths = -delta;
    const first36 = Math.min(36, earlyMonths);
    const additional = Math.max(0, earlyMonths - 36);
    const reduction = (first36 * (5 / 9 / 100)) + (additional * (5 / 12 / 100));
    return Math.max(0, 1 - reduction);
  } else if (delta > 0) {
    const maxDelayMonths = Math.round(70 * 12) - nra.totalMonths;
    const delayMonths = Math.min(delta, Math.max(0, maxDelayMonths));
    const increase = delayMonths * (2 / 3 / 100);
    return 1 + increase;
  }

  return 1.0;
}

/**
 * Calculates the Canadian CPP claim-age adjustment factor (0.6%/mo early reduction down to 60, 0.7%/mo delayed increase up to 70).
 */
export function calculateCppAdjustment(startAge: number): number {
  const clampedAge = Math.max(60, Math.min(70, startAge));
  const startMonths = Math.round(clampedAge * 12);
  const standardMonths = 65 * 12; // 780
  const delta = startMonths - standardMonths;

  if (delta < 0) {
    const earlyMonths = -delta;
    return Math.max(0, 1 - (earlyMonths * 0.006));
  } else if (delta > 0) {
    const delayMonths = delta;
    return 1 + (delayMonths * 0.007);
  }

  return 1.0;
}

/**
 * Calculates the Canadian OAS claim-age adjustment factor (0.6%/mo delayed increase up to age 70).
 */
export function calculateOasAdjustment(startAge: number): number {
  if (startAge < 65) {
    return 1.0; // Payout is 0 before 65, factor defaults to 1.0
  }
  const clampedAge = Math.min(70, startAge);
  const startMonths = Math.round(clampedAge * 12);
  const standardMonths = 65 * 12; // 780
  const delayMonths = Math.max(0, startMonths - standardMonths);

  return 1 + (delayMonths * 0.006);
}

/**
 * Calculates the Canadian OAS clawback (15% of net income above $90,997).
 */
export function calculateOasClawback(grossOas: number, netIncome: number): number {
  if (grossOas <= 0) return 0;
  const threshold = 90997;
  if (netIncome <= threshold) return 0;
  return Math.min(grossOas, Math.max(0, (netIncome - threshold) * 0.15));
}

/**
 * Calculates the benefit details for an individual pension in a given simulation year.
 */
export function calculatePensionBenefit(input: PensionInput): PensionOutput {
  const { pension, birthYear, currentAge, yearsElapsed, inflationRate, netIncomeForOas } = input;

  if (currentAge < pension.startAge || pension.baseAmount <= 0) {
    return {
      pensionId: pension.id,
      type: pension.type,
      owner: pension.owner,
      grossAmount: 0,
      clawbackAmount: 0,
      netAmount: 0,
      claimAgeAdjustmentFactor: 1.0,
    };
  }

  let claimAgeAdjustmentFactor = 1.0;
  if (pension.type === 'social_security') {
    claimAgeAdjustmentFactor = calculateSocialSecurityAdjustment(birthYear, pension.startAge);
  } else if (pension.type === 'cpp') {
    claimAgeAdjustmentFactor = calculateCppAdjustment(pension.startAge);
  } else if (pension.type === 'oas') {
    claimAgeAdjustmentFactor = calculateOasAdjustment(pension.startAge);
  }

  const inflationFactor = pension.inflationAdjusted ? Math.pow(1 + inflationRate, Math.max(0, yearsElapsed)) : 1.0;
  const grossAmount = pension.baseAmount * claimAgeAdjustmentFactor * inflationFactor;

  let clawbackAmount = 0;
  if (pension.type === 'oas' && netIncomeForOas !== undefined) {
    clawbackAmount = calculateOasClawback(grossAmount, netIncomeForOas);
  }

  const netAmount = Math.max(0, grossAmount - clawbackAmount);

  return {
    pensionId: pension.id,
    type: pension.type,
    owner: pension.owner,
    grossAmount,
    clawbackAmount,
    netAmount,
    claimAgeAdjustmentFactor,
  };
}

/**
 * Main delegator to calculate all pensions for a household in a given simulation year.
 */
export function calculateAllPensions(
  household: Household,
  currentYear: number,
  inflationRate: number,
  netIncomeForOas?: number
): PensionOutput[] {
  if (!household.pensions || household.pensions.length === 0) {
    return [];
  }

  return household.pensions.map(pension => {
    const isSpouse = pension.owner === 'spouse';
    const birthYear = isSpouse ? (household.spouseBirthYear ?? household.birthYear) : household.birthYear;
    const currentAge = currentYear - birthYear;
    
    // Determine base retirement year to calculate yearsElapsed for inflation indexing
    const retirementAge = isSpouse ? (household.spouseRetirementAge ?? household.retirementAge) : household.retirementAge;
    const retirementStartYear = birthYear + retirementAge;
    const yearsElapsed = currentYear - retirementStartYear;

    return calculatePensionBenefit({
      pension,
      birthYear,
      currentAge,
      yearsElapsed,
      inflationRate,
      netIncomeForOas,
    });
  });
}
```

### Proposed Test Strategy for `__tests__/planner/pensionEngine.spec.ts`
The test file must import all functions from `src/lib/planner/pensionEngine` and define 6 `describe` suites:
1. **`calculateSocialSecurityNra`**: Test birth years `<=1937` (65), `1938-1942` (65 + 2mo/yr), `1943-1954` (66), `1955-1959` (66 + 2mo/yr), and `>=1960` (67).
2. **`calculateSocialSecurityAdjustment`**: Test early claim at 62 for 1960 birth year (30% reduction -> 0.70 factor), exact NRA claim (1.0 factor), delayed claim at 70 (24% increase -> 1.24 factor), and capping beyond age 70.
3. **`calculateCppAdjustment`**: Test early claim at 60 (36% reduction -> 0.64 factor), standard claim at 65 (1.0 factor), delayed claim at 70 (42% increase -> 1.42 factor), and out-of-bounds clamping (<60 or >70).
4. **`calculateOasAdjustment` & `calculateOasClawback`**: Test claim before 65, exact 65 claim, delayed claim at 70 (36% increase -> 1.36 factor). Test clawback with net income below $90,997 (0 clawback), partial clawback above $90,997, and full clawback exceeding gross OAS.
5. **`calculatePensionBenefit`**: Test Defined Benefit (1.0 factor), `currentAge < startAge` (0 payout), `baseAmount <= 0`, and `inflationAdjusted: true` vs `false`.
6. **`calculateAllPensions`**: Test household with primary SS and spouse CPP/OAS, verifying correct binding of `spouseBirthYear`, `currentAge`, and `yearsElapsed`.

---

## 5. Verification Method

### Static Analysis & Type Checking
```bash
npx tsc --noEmit
```

### Unit Testing & Coverage
```bash
npm run test __tests__/planner/pensionEngine.spec.ts
```
*(Alternatively: `npx jest __tests__/planner/pensionEngine.spec.ts --coverage`)*

### Full Planner Suite Regression Check
```bash
npm run test __tests__/planner
```

### Invalidation Conditions
Any test failure, TypeScript compilation error, or linter/audit violation invalidates the implementation.
