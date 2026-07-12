# Handoff Report: Pension Engine Exploration

## Observation

We conducted a thorough, read-only investigation of the existing codebase, domain types, and project requirements to establish the architectural design and test strategy for `src/lib/planner/pensionEngine.ts` and `__tests__/planner/pensionEngine.spec.ts`.

### Direct Observations & File Inspections
1. **Task Definition (`task.md`)**:
   - Outlines the objective to explore requirements and design for `pensionEngine.ts` and `__tests__/planner/pensionEngine.spec.ts`.
   - Explicitly mandates implementing public pension claim-age adjustments: US Social Security early claim penalties / delayed retirement credits, Canadian CPP early/delayed adjustments, Canadian OAS delayed adjustments, Defined Benefit base amounts, and OAS clawback logic.

2. **Domain Types & Validation Schemas (`src/lib/planner/types.ts`)**:
   - `PensionSchema` (lines 56–72) defines:
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
     ```
   - `HouseholdSchema` (lines 110–140) captures `birthYear`, `spouseBirthYear`, `retirementAge`, `spouseRetirementAge`, `taxJurisdiction` (`'US' | 'CA'`), and `pensions`.

3. **Existing Pure Business Logic Engine Pattern (`src/lib/planner/taxEngine.ts`)**:
   - Implemented as a pure TypeScript module exporting clear, strong TypeScript interfaces (`TaxInput`, `TaxOutput`, `TaxBracket`) and independent pure functions (`calculateUsTaxes`, `calculateCaTaxes`, `calculateTaxes`, `calculateProgressiveTax`).
   - Demonstrates zero side effects, no state mutation, and clean separation of concerns.

4. **Directory Structure & Missing Files (`src/lib/planner`, `__tests__/planner`)**:
   - `list_dir` on `src/lib/planner` confirmed only `taxEngine.ts` and `types.ts` exist. `pensionEngine.ts` has not been created yet.
   - `list_dir` on `__tests__/planner` confirmed `taxEngine.spec.ts`, `adv_taxEngine.spec.ts`, `adv_taxEngine_2.spec.ts`, `types.spec.ts`, and `adv_types.spec.ts` exist. `pensionEngine.spec.ts` has not been created yet.

5. **Project & Scope Alignment (`.agents/orchestrator/PROJECT.md`, `.agents/sub_orch_m1_core_domain_1/SCOPE.md`)**:
   - `PROJECT.md` identifies Milestone 1 (Core Domain Types & Pure Business Logic Engines) as `IN_PROGRESS` and requires `pensionEngine.ts` to be a pure TS engine.
   - `SCOPE.md` mandates 100% passing test coverage (`npm run test __tests__/planner`).
   - `package.json` confirms `"test": "jest"` as the test execution framework.

---

## Logic Chain

1. **Alignment with Pure Functional Engine Pattern**:
   - *Premise*: `taxEngine.ts` establishes the canonical architectural pattern for business logic engines in this repository.
   - *Inference*: `pensionEngine.ts` must similarly define standalone TypeScript interfaces for its inputs and outputs (`PensionEvaluationInput`, `PensionEvaluationResult`, `OasClawbackInput`, `OasClawbackResult`) and export pure, modular functions for each statutory pension calculation.

2. **US Social Security Statutory Logic**:
   - *Premise*: `task.md` mandates modeling Normal Retirement Age (NRA) by birth year, early claiming penalties down to age 62, and delayed retirement credits (DRC) up to age 70.
   - *Inference*: 
     - We require a helper `calculateSocialSecurityNRA(birthYear: number): number` to map birth years 1937–1960+ to NRAs (65 to 67, including 2-month fractional increments for 1938–1942 and 1955–1959).
     - We require `calculateSocialSecurityAdjustmentFactor(startAge: number, birthYear: number): number`.
     - Early claim penalty formula: for the first 36 months early, reduction is `(5/9) * 1%` (`5 / 900`) per month. For months early beyond 36 (up to 60 total months early), reduction is `(5/12) * 1%` (`5 / 1200`) per month.
     - Delayed retirement credit formula: for birth years 1943+, increase is `(2/3) * 1%` (`2 / 300`) per month up to age 70.

3. **Canadian CPP Statutory Logic**:
   - *Premise*: `task.md` mandates standard start age 65, early claiming reduction (0.6% per month down to age 60), and delayed claiming increase (0.7% per month up to age 70).
   - *Inference*: We require `calculateCppAdjustmentFactor(startAge: number): number`. Months early (between 60 and 65) reduce the factor by `0.006` per month (max 36% reduction at 60, factor `0.64`). Months delayed (between 65 and 70) increase the factor by `0.007` per month (max 42% increase at 70, factor `1.42`). Ages outside [60, 70] must be clamped.

4. **Canadian OAS Statutory Logic & Clawback**:
   - *Premise*: `task.md` mandates standard start age 65, delayed claiming increase (0.6% per month up to age 70), and OAS clawback thresholds (~$90,997 net income base).
   - *Inference*: 
     - We require `calculateOasAdjustmentFactor(startAge: number): number`. Months delayed (between 65 and 70) increase the factor by `0.006` per month (max 36% increase at 70, factor `1.36`). Early claiming before 65 is not permitted (defaults to factor 1.0 when eligible at 65).
     - We require `calculateOasClawback(input: OasClawbackInput): OasClawbackResult`. Net income above $90,997 incurs a 15% clawback (`0.15 * (netIncome - 90997)`), clamped between `0` and the total `oasBenefit`.

5. **Defined Benefit & Overall Benefit Evaluation**:
   - *Premise*: `task.md` mandates flat or inflation-adjusted base amounts starting at `startAge`.
   - *Inference*: `evaluatePension(input: PensionEvaluationInput): PensionEvaluationResult` must evaluate eligibility (`currentAge >= pension.startAge`), apply the appropriate adjustment factor based on `pension.type`, and compound inflation (`Math.pow(1 + inflationRate, Math.max(0, simulationYear - 1))`) if `pension.inflationAdjusted` is true.

---

## Caveats

1. **Historical DRC Nuance for Pre-1943 Birth Years**:
   - For US Social Security, individuals born prior to 1943 had slightly lower delayed retirement credit rates (e.g., 6.5% to 7.5% per year). Since `task.md` specifies the standard DRC rule and anyone retiring in 2026+ was born after 1943 (someone born in 1943 is 83 in 2026, well past the age 70 DRC cap), using the standard `2/300` per month DRC rule for all delayed claims is highly appropriate and avoids unnecessary lookup complexity.

2. **Rounding of Fractional Months**:
   - Since `startAge` is a floating-point number in `PensionSchema` (e.g., `62.5` for 62 and 6 months), we utilize `Math.round((ageDiff) * 12)` to determine exact integer month differences, avoiding floating-point precision artifacts in JavaScript.

3. **Indexing of Simulation Years**:
   - We assume `simulationYear` is 1-indexed (e.g., Year 1 is the first year of retirement). Therefore, inflation compounding uses `simulationYear - 1` as the exponent. If Year 1 represents the base year, no inflation compounding occurs until Year 2.

---

## Conclusion

We propose the creation of `src/lib/planner/pensionEngine.ts` and `__tests__/planner/pensionEngine.spec.ts` following a highly modular, pure functional design. 

### Architectural Blueprint for `src/lib/planner/pensionEngine.ts`

```typescript
import { Pension, Household } from './types';

export interface PensionEvaluationInput {
  pension: Pension;
  birthYear: number;
  currentAge: number;
  simulationYear: number;
  inflationRate: number;
}

export interface PensionEvaluationResult {
  id: string;
  type: Pension['type'];
  owner: Pension['owner'];
  isEligible: boolean;
  baseAmount: number;
  adjustmentFactor: number;
  adjustedBaseAmount: number;
  grossBenefit: number;
}

export interface OasClawbackInput {
  oasBenefit: number;
  netIncome: number;
  clawbackThreshold?: number; // Defaults to 90997
}

export interface OasClawbackResult {
  oasBenefit: number;
  clawbackAmount: number;
  netOasBenefit: number;
}

/**
 * Calculates US Social Security Normal Retirement Age (NRA) based on birth year.
 */
export function calculateSocialSecurityNRA(birthYear: number): number {
  if (birthYear <= 1937) return 65;
  if (birthYear === 1938) return 65 + 2 / 12;
  if (birthYear === 1939) return 65 + 4 / 12;
  if (birthYear === 1940) return 65 + 6 / 12;
  if (birthYear === 1941) return 65 + 8 / 12;
  if (birthYear === 1942) return 65 + 10 / 12;
  if (birthYear >= 1943 && birthYear <= 1954) return 66;
  if (birthYear === 1955) return 66 + 2 / 12;
  if (birthYear === 1956) return 66 + 4 / 12;
  if (birthYear === 1957) return 66 + 6 / 12;
  if (birthYear === 1958) return 66 + 8 / 12;
  if (birthYear === 1959) return 66 + 10 / 12;
  return 67;
}

/**
 * Calculates US Social Security early claiming penalty or delayed retirement credit factor.
 */
export function calculateSocialSecurityAdjustmentFactor(startAge: number, birthYear: number): number {
  const nra = calculateSocialSecurityNRA(birthYear);
  if (startAge < nra) {
    const monthsEarly = Math.round((nra - startAge) * 12);
    const first36 = Math.min(36, monthsEarly);
    const additional = Math.max(0, monthsEarly - 36);
    const factor = 1.0 - (first36 * (5 / 900)) - (additional * (5 / 1200));
    return Math.max(0, factor);
  } else if (startAge > nra) {
    const effectiveStart = Math.min(70, startAge);
    const monthsDelayed = Math.max(0, Math.round((effectiveStart - nra) * 12));
    return 1.0 + monthsDelayed * (2 / 300);
  }
  return 1.0;
}

/**
 * Calculates Canadian CPP early/delayed adjustment factor.
 */
export function calculateCppAdjustmentFactor(startAge: number): number {
  const clampedAge = Math.max(60, Math.min(70, startAge));
  if (clampedAge < 65) {
    const monthsEarly = Math.round((65 - clampedAge) * 12);
    return Math.max(0, 1.0 - monthsEarly * 0.006);
  } else if (clampedAge > 65) {
    const monthsDelayed = Math.round((clampedAge - 65) * 12);
    return 1.0 + monthsDelayed * 0.007;
  }
  return 1.0;
}

/**
 * Calculates Canadian OAS delayed adjustment factor.
 */
export function calculateOasAdjustmentFactor(startAge: number): number {
  if (startAge < 65) return 1.0; // Early claiming not permitted; standard amount begins at 65
  const clampedAge = Math.min(70, startAge);
  const monthsDelayed = Math.round((clampedAge - 65) * 12);
  return 1.0 + monthsDelayed * 0.006;
}

/**
 * Universal delegator to compute adjustment factor for any pension type.
 */
export function calculatePensionAdjustmentFactor(pension: Pension, birthYear: number): number {
  switch (pension.type) {
    case 'social_security':
      return calculateSocialSecurityAdjustmentFactor(pension.startAge, birthYear);
    case 'cpp':
      return calculateCppAdjustmentFactor(pension.startAge);
    case 'oas':
      return calculateOasAdjustmentFactor(pension.startAge);
    case 'defined_benefit':
    default:
      return 1.0;
  }
}

/**
 * Evaluates a single pension's current gross benefit for a given simulation year and age.
 */
export function evaluatePension(input: PensionEvaluationInput): PensionEvaluationResult {
  const { pension, birthYear, currentAge, simulationYear, inflationRate } = input;
  const isEligible = currentAge >= pension.startAge;
  
  const adjustmentFactor = calculatePensionAdjustmentFactor(pension, birthYear);
  const adjustedBaseAmount = pension.baseAmount * adjustmentFactor;
  
  let grossBenefit = 0;
  if (isEligible) {
    if (pension.inflationAdjusted) {
      const exponent = Math.max(0, simulationYear - 1);
      grossBenefit = adjustedBaseAmount * Math.pow(1 + inflationRate, exponent);
    } else {
      grossBenefit = adjustedBaseAmount;
    }
  }

  return {
    id: pension.id,
    type: pension.type,
    owner: pension.owner,
    isEligible,
    baseAmount: pension.baseAmount,
    adjustmentFactor,
    adjustedBaseAmount,
    grossBenefit,
  };
}

/**
 * Evaluates all pensions for a household in a given simulation year.
 */
export function evaluateAllPensions(
  pensions: Pension[],
  household: Household,
  simulationYear: number,
  inflationRate: number,
  primaryAge: number,
  spouseAge?: number
): PensionEvaluationResult[] {
  return pensions.map(pension => {
    const isSpouse = pension.owner === 'spouse';
    const currentAge = isSpouse ? (spouseAge ?? primaryAge) : primaryAge;
    const birthYear = isSpouse ? (household.spouseBirthYear ?? household.birthYear) : household.birthYear;
    return evaluatePension({
      pension,
      birthYear,
      currentAge,
      simulationYear,
      inflationRate,
    });
  });
}

/**
 * Calculates Canadian OAS clawback (recovery tax) based on net income.
 */
export function calculateOasClawback(input: OasClawbackInput): OasClawbackResult {
  const threshold = input.clawbackThreshold ?? 90997;
  if (input.oasBenefit <= 0 || input.netIncome <= threshold) {
    return {
      oasBenefit: input.oasBenefit,
      clawbackAmount: 0,
      netOasBenefit: input.oasBenefit,
    };
  }

  const rawClawback = (input.netIncome - threshold) * 0.15;
  const clawbackAmount = Math.min(input.oasBenefit, Math.max(0, rawClawback));

  return {
    oasBenefit: input.oasBenefit,
    clawbackAmount,
    netOasBenefit: input.oasBenefit - clawbackAmount,
  };
}
```

### Unit Test Strategy for `__tests__/planner/pensionEngine.spec.ts`

The unit test file must import `calculateSocialSecurityNRA`, `calculateSocialSecurityAdjustmentFactor`, `calculateCppAdjustmentFactor`, `calculateOasAdjustmentFactor`, `calculatePensionAdjustmentFactor`, `evaluatePension`, `evaluateAllPensions`, and `calculateOasClawback` from `src/lib/planner/pensionEngine`, along with `Pension` and `Household` types from `src/lib/planner/types`.

It must implement the following test suites with 100% statement and branch coverage:
1. **NRA Calculation Tests**: Verify correct NRA for 1935 (65), 1938–1942 (fractional ages), 1950 (66), 1955–1959 (fractional ages), and 1965 (67).
2. **Social Security Adjustment Tests**: Verify exact early claiming penalties at age 62 (NRA 67 -> 0.70 factor; NRA 66 -> 0.75 factor), delayed retirement credits at age 70 (NRA 67 -> 1.24 factor; NRA 66 -> 1.32 factor), and claiming at exact NRA (1.0 factor). Verify clamping past age 70.
3. **CPP Adjustment Tests**: Verify exact early claiming reduction at age 60 (0.64 factor), delayed increase at age 70 (1.42 factor), claiming at 65 (1.0 factor), and clamping outside [60, 70].
4. **OAS Adjustment Tests**: Verify claiming at 65 (1.0 factor), delayed increase at age 70 (1.36 factor), and clamping past age 70.
5. **Defined Benefit Tests**: Verify factor is always 1.0 regardless of age.
6. **Pension Benefit Evaluation Tests**:
   - Verify `isEligible = false` and `grossBenefit = 0` when `currentAge < startAge`.
   - Verify correct inflation compounding across multiple simulation years (`simulationYear = 1, 5, 10, 30`).
   - Verify flat gross benefit when `inflationAdjusted` is false.
   - Verify `evaluateAllPensions` correctly routes primary vs. spouse owners and applies correct birth years/ages.
7. **OAS Clawback Tests**: Verify zero clawback when `netIncome <= 90997`, partial 15% clawback when `netIncome > 90997`, and full clawback capping when `netIncome` is extremely high.

---

## Verification Method

To independently verify the implementation once the implementer completes the code:

1. **Static Analysis & Type Checking**:
   Run TypeScript compiler to verify zero type errors across the newly created engine and test files:
   ```bash
   npx tsc --noEmit
   ```

2. **Unit Test Verification**:
   Execute Jest specifically on the new pension engine test suite to verify 100% passing tests:
   ```bash
   npx jest __tests__/planner/pensionEngine.spec.ts
   ```
   Or run all planner unit tests to ensure zero regressions in existing engines:
   ```bash
   npm run test __tests__/planner
   ```

3. **Linter Verification**:
   Verify adherence to project ESLint rules:
   ```bash
   npm run lint
   ```
