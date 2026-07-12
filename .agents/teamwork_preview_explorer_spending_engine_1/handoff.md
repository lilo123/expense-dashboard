# Milestone 1.4: Spending Engine Exploration Report

**Date:** 2026-06-23  
**Identity:** Spending Engine Explorer 1 (`teamwork_preview_explorer`)  
**Scope:** `src/lib/planner/spendingEngine.ts` and `__tests__/planner/spendingEngine.spec.ts`

---

## 1. Observation

During our read-only exploration of the project architecture, scope, domain types, and existing engines, we gathered the following concrete observations:

### 1.1 Project & Milestone Scope
- **`PROJECT.md` (lines 7, 14, 35):** Identifies `spendingEngine.ts` as one of the "Pure Business Logic Engines" under Milestone 1 ("Core Domain Types & Pure Business Logic Engines"), currently marked as `IN_PROGRESS`.
- **`SCOPE.md` (lines 8, 18, 22-24):** Specifies Milestone 1.4: Spending Engine (`src/lib/planner/spendingEngine.ts`, `__tests__/planner/spendingEngine.spec.ts`) as `PLANNED`. It mandates that all engines must import and use Zod schemas and inferred TypeScript types from `types.ts`, and must be "pure functions with zero side effects."

### 1.2 Domain Types (`src/lib/planner/types.ts`)
- **`SpendingSchema` (lines 21-53):**
  ```typescript
  export const SpendingSchema = z.object({
    initialBase: z.number().positive("Initial spending base must be positive"),
    strategy: z.enum(['constant_dollar', 'vanguard_dynamic', 'yale_endowment']),
    minWithdrawal: z.number().positive("Minimum withdrawal floor must be positive").optional(),
    maxWithdrawal: z.number().positive("Maximum withdrawal ceiling must be positive").optional(),
    yaleWeight: z.number().min(0).max(1, "Yale weight must be between 0 and 1").optional(),
    inflationAdjusted: z.boolean(),
  }).refine(data => {
    if (data.strategy === 'vanguard_dynamic') {
      return data.minWithdrawal !== undefined && data.maxWithdrawal !== undefined;
    }
    return true;
  }, {
    message: "vanguard_dynamic strategy requires minWithdrawal and maxWithdrawal",
    path: ['strategy'],
  }).refine(data => {
    if (data.minWithdrawal !== undefined && data.maxWithdrawal !== undefined) {
      return data.minWithdrawal <= data.maxWithdrawal;
    }
    return true;
  }, {
    message: "minWithdrawal cannot exceed maxWithdrawal",
    path: ['minWithdrawal'],
  }).refine(data => {
    if (data.strategy === 'yale_endowment') {
      return data.yaleWeight !== undefined;
    }
    return true;
  }, {
    message: "yale_endowment strategy requires yaleWeight",
    path: ['yaleWeight'],
  });
  export type Spending = z.infer<typeof SpendingSchema>;
  ```

### 1.3 Unit & Adversarial Tests (`__tests__/planner/types.spec.ts` & `adv_types.spec.ts`)
- **`types.spec.ts` (lines 51-81):** Confirms `vanguard_dynamic` uses absolute dollar amounts for clamps (e.g., `initialBase: 50000`, `minWithdrawal: 40000`, `maxWithdrawal: 60000`).
- **`adv_types.spec.ts` (lines 103-134):** Explicitly verifies Zod invariant rejections: `minWithdrawal > maxWithdrawal`, missing clamps for `vanguard_dynamic`, and missing `yaleWeight` for `yale_endowment`.

### 1.4 Existing Engine Implementations (`taxEngine.ts` & `pensionEngine.ts`)
- **`taxEngine.ts` (lines 3-27, 44, 368):** Defines clear interfaces (`TaxInput`, `TaxOutput`), modular pure sub-calculations (`calculateProgressiveTax`, `calculateUsTaxes`), and a central delegator (`calculateTaxes`).
- **`pensionEngine.ts` (lines 3-20, 102, 155):** Defines `PensionInput` and `PensionOutput`, modular sub-helpers (`calculateSocialSecurityAdjustment`), a central delegator (`calculatePensionBenefit`), and an aggregate helper (`calculateAllPensions`) taking a `Household`.

---

## 2. Logic Chain

Based on the direct observations above, we establish the following step-by-step architectural logic chain for implementing `spendingEngine.ts` and its unit tests:

1. **Alignment with Pure Engine Principles:**
   - *Premise:* `SCOPE.md` lines 22-24 mandate pure functions with zero side effects using `types.ts`.
   - *Inference:* `spendingEngine.ts` must export `SpendingInput` and `SpendingOutput` interfaces, along with pure calculation helpers and a central delegator function (`calculateSpending`), mirroring the structure of `taxEngine.ts` and `pensionEngine.ts`.

2. **Constant Dollar Mechanics & Formulas:**
   - *Premise:* The strategy withdraws `initialBase`, adjusted for inflation each year if `inflationAdjusted` is true.
   - *Inference:* The base withdrawal formula in year $t$ (where $t = \text{yearsElapsed}$) is:
     $$\text{Withdrawal}_t = \text{initialBase} \times (1 + \text{inflationRate})^{\max(0, \text{yearsElapsed})}$$
     If `inflationAdjusted` is false, $\text{Withdrawal}_t = \text{initialBase}$.

3. **Vanguard Dynamic Mechanics & Formulas:**
   - *Premise:* The strategy calculates a percentage of portfolio or adjusted base, constrained by `minWithdrawal` (floor) and `maxWithdrawal` (ceiling), adjusted for inflation if applicable.
   - *Inference:* 
     - **Withdrawal Rate ($r$):** Initial withdrawal percentage $r = \frac{\text{initialBase}}{\text{initialPortfolio}}$. If `initialPortfolio <= 0`, fallback to unconstrained target $W_{\text{target}} = \text{initialBase} \times \text{inflationFactor}$.
     - **Unconstrained Target ($W_{\text{target}}$):** $W_{\text{target}} = \text{currentPortfolio} \times r$.
     - **Inflation Adjustments on Clamps:** If `inflationAdjusted` is true, the floor and ceiling dollar amounts must also adjust with inflation over time:
       $$\text{Floor}_t = \text{minWithdrawal} \times \text{inflationFactor}$$
       $$\text{Ceiling}_t = \text{maxWithdrawal} \times \text{inflationFactor}$$
     - **Final Clamped Withdrawal:** $\text{Withdrawal}_t = \min(\text{Ceiling}_t, \max(\text{Floor}_t, W_{\text{target}}))$.

4. **Yale Endowment Mechanics & Formulas:**
   - *Premise:* The strategy takes a weighted combination of last year's spending (inflation adjusted) and a target percentage of the current portfolio balance (using `yaleWeight`).
   - *Inference:*
     - Let $w = \text{yaleWeight}$ (clamped to $[0, 1]$).
     - Let $r = \frac{\text{initialBase}}{\text{initialPortfolio}}$. (If `initialPortfolio <= 0`, fallback $r = 0$).
     - In year 0 (`yearsElapsed === 0` or `previousSpending === undefined`), there is no previous year spending to weight, so initialize $\text{Withdrawal}_0 = \text{initialBase}$.
     - In subsequent years:
       $$\text{Withdrawal}_t = w \times \left(\text{previousSpending} \times (1 + \text{inflationRate})\right) + (1 - w) \times \left(\text{currentPortfolio} \times r\right)$$
       *(Note: If `inflationAdjusted` is false, `previousSpending` is not multiplied by $1 + \text{inflationRate}$).*

5. **Household Integration:**
   - *Premise:* `pensionEngine.ts` provides `calculateAllPensions(household, currentYear, ...)`.
   - *Inference:* `spendingEngine.ts` should provide `getHouseholdSpending(household, currentPortfolio, initialPortfolio, currentYear, inflationRate, previousSpending?)` to calculate `yearsElapsed` from household demographics (`currentYear - (birthYear + retirementAge)`) and invoke `calculateSpending`.

6. **Defensive & Adversarial Hardening:**
   - *Premise:* The codebase enforces strict adversarial testing (`adv_types.spec.ts`, `adv_taxEngine.spec.ts`).
   - *Inference:* The pure engine functions must robustly handle edge cases at runtime (e.g., division by zero when `initialPortfolio <= 0`, negative `yearsElapsed`, inverted clamps where `minWithdrawal > maxWithdrawal`, missing optional fields, and `yaleWeight` out of bounds).

---

## 3. Caveats

- **Portfolio Depletion Handling:** The spending engine calculates the *target spending withdrawal* for the year. If `currentPortfolio` is 0, Vanguard Dynamic might still return $\text{Floor}_t$. It is assumed that the downstream drawdown engine / simulator is responsible for attempting the actual asset liquidation and flagging a retirement shortfall / failure if accounts are depleted.
- **Deflation Handling:** If `inflationRate` is negative (deflation), the compound inflation factor $(1 + \text{inflationRate})^{\text{yearsElapsed}}$ will decrease below 1.0. The engine assumes this is intended behavior for real purchasing power alignment, provided $1 + \text{inflationRate} \ge 0$.
- **Household Demographics:** When calculating `yearsElapsed` in `getHouseholdSpending`, we assume `yearsElapsed = currentYear - (household.birthYear + household.retirementAge)`, consistent with `pensionEngine.ts`.

---

## 4. Conclusion

We recommend implementing `src/lib/planner/spendingEngine.ts` and `__tests__/planner/spendingEngine.spec.ts` according to the following precise, production-grade specification.

### 4.1 Recommended Contract (`src/lib/planner/spendingEngine.ts`)

```typescript
import { Spending, Household } from './types';

export interface SpendingInput {
  spending: Spending;
  currentPortfolio: number;
  initialPortfolio: number;
  yearsElapsed: number;
  inflationRate: number;
  previousSpending?: number;
}

export interface SpendingOutput {
  strategy: Spending['strategy'];
  targetWithdrawal: number;
  unconstrainedWithdrawal: number;
  floor?: number;
  ceiling?: number;
  inflationFactor: number;
}

/**
 * Pure helper to calculate the compound inflation factor.
 */
export function calculateInflationFactor(
  inflationRate: number,
  yearsElapsed: number,
  inflationAdjusted: boolean
): number {
  if (!inflationAdjusted || yearsElapsed <= 0) {
    return 1.0;
  }
  const effectiveRate = Math.max(-1.0, inflationRate);
  return Math.pow(1 + effectiveRate, yearsElapsed);
}

/**
 * Calculates Constant Dollar spending withdrawal.
 */
export function calculateConstantDollar(input: SpendingInput): SpendingOutput {
  const { spending, yearsElapsed, inflationRate } = input;
  const initialBase = Math.max(0, spending.initialBase);
  const inflationFactor = calculateInflationFactor(inflationRate, yearsElapsed, spending.inflationAdjusted);
  const targetWithdrawal = initialBase * inflationFactor;

  return {
    strategy: 'constant_dollar',
    targetWithdrawal,
    unconstrainedWithdrawal: targetWithdrawal,
    inflationFactor,
  };
}

/**
 * Calculates Vanguard Dynamic spending withdrawal.
 */
export function calculateVanguardDynamic(input: SpendingInput): SpendingOutput {
  const { spending, currentPortfolio, initialPortfolio, yearsElapsed, inflationRate } = input;
  const initialBase = Math.max(0, spending.initialBase);
  const inflationFactor = calculateInflationFactor(inflationRate, yearsElapsed, spending.inflationAdjusted);

  let unconstrainedWithdrawal = 0;
  if (initialPortfolio > 0) {
    const rate = initialBase / initialPortfolio;
    unconstrainedWithdrawal = Math.max(0, currentPortfolio) * rate;
  } else {
    unconstrainedWithdrawal = initialBase * inflationFactor;
  }

  const rawMin = spending.minWithdrawal ?? initialBase;
  const rawMax = spending.maxWithdrawal ?? initialBase;
  const effectiveMin = Math.min(rawMin, rawMax);
  const effectiveMax = Math.max(rawMin, rawMax);

  const floor = effectiveMin * inflationFactor;
  const ceiling = effectiveMax * inflationFactor;

  const targetWithdrawal = Math.min(ceiling, Math.max(floor, unconstrainedWithdrawal));

  return {
    strategy: 'vanguard_dynamic',
    targetWithdrawal,
    unconstrainedWithdrawal,
    floor,
    ceiling,
    inflationFactor,
  };
}

/**
 * Calculates Yale Endowment spending withdrawal.
 */
export function calculateYaleEndowment(input: SpendingInput): SpendingOutput {
  const { spending, currentPortfolio, initialPortfolio, yearsElapsed, inflationRate, previousSpending } = input;
  const initialBase = Math.max(0, spending.initialBase);
  const inflationFactor = calculateInflationFactor(inflationRate, yearsElapsed, spending.inflationAdjusted);

  if (yearsElapsed <= 0 || previousSpending === undefined) {
    return {
      strategy: 'yale_endowment',
      targetWithdrawal: initialBase,
      unconstrainedWithdrawal: initialBase,
      inflationFactor,
    };
  }

  const rawWeight = spending.yaleWeight ?? 0.7;
  const w = Math.max(0, Math.min(1, rawWeight));

  let currentPortfolioPortion = 0;
  if (initialPortfolio > 0) {
    const rate = initialBase / initialPortfolio;
    currentPortfolioPortion = Math.max(0, currentPortfolio) * rate;
  } else {
    currentPortfolioPortion = initialBase * inflationFactor;
  }

  const priorAdjustmentRate = spending.inflationAdjusted ? Math.max(-1.0, inflationRate) : 0;
  const priorSpendingPortion = Math.max(0, previousSpending) * (1 + priorAdjustmentRate);

  const targetWithdrawal = w * priorSpendingPortion + (1 - w) * currentPortfolioPortion;

  return {
    strategy: 'yale_endowment',
    targetWithdrawal,
    unconstrainedWithdrawal: targetWithdrawal,
    inflationFactor,
  };
}

/**
 * Main delegator function branching on spending strategy.
 */
export function calculateSpending(input: SpendingInput): SpendingOutput {
  if (input.spending.strategy === 'vanguard_dynamic') {
    return calculateVanguardDynamic(input);
  } else if (input.spending.strategy === 'yale_endowment') {
    return calculateYaleEndowment(input);
  }
  return calculateConstantDollar(input);
}

/**
 * Calculates spending for a household given current year and portfolio values.
 */
export function getHouseholdSpending(
  household: Household,
  currentPortfolio: number,
  initialPortfolio: number,
  currentYear: number,
  inflationRate: number,
  previousSpending?: number
): SpendingOutput {
  if (!household.spending) {
    return {
      strategy: 'constant_dollar',
      targetWithdrawal: 0,
      unconstrainedWithdrawal: 0,
      inflationFactor: 1.0,
    };
  }

  const birthYear = household.birthYear;
  const retirementAge = household.retirementAge;
  const yearsElapsed = currentYear - (birthYear + retirementAge);

  return calculateSpending({
    spending: household.spending,
    currentPortfolio,
    initialPortfolio,
    yearsElapsed,
    inflationRate,
    previousSpending,
  });
}
```

### 4.2 Recommended Unit Test Suite (`__tests__/planner/spendingEngine.spec.ts`)

The unit test suite must implement the following test cases across 5 `describe` blocks to ensure 100% test coverage and adversarial robustness:

1. **Constant Dollar Strategy Tests (`describe('Constant Dollar')`):**
   - Standard calculation without inflation (`inflationAdjusted: false`, `yearsElapsed: 5`).
   - Standard calculation with inflation (`inflationAdjusted: true`, `inflationRate: 0.03`, `yearsElapsed: 10`).
   - Negative `yearsElapsed` clamps to `1.0` inflation factor.
   - Negative `initialBase` clamps to `0`.

2. **Vanguard Dynamic Strategy Tests (`describe('Vanguard Dynamic')`):**
   - Unconstrained withdrawal falling between floor and ceiling.
   - Portfolio crash clamping target withdrawal to `floor`.
   - Portfolio surge clamping target withdrawal to `ceiling`.
   - Inflation adjustments applied correctly to floor and ceiling when `inflationAdjusted: true`.
   - Adversarial: `minWithdrawal > maxWithdrawal` (should auto-swap in pure engine logic).
   - Adversarial: `initialPortfolio: 0` (division by zero prevention).
   - Adversarial: Missing `minWithdrawal`/`maxWithdrawal` falls back cleanly to `initialBase`.

3. **Yale Endowment Strategy Tests (`describe('Yale Endowment')`):**
   - First year of retirement (`yearsElapsed: 0`) returns `initialBase`.
   - Subsequent year blending `previousSpending` and `currentPortfolio` with `yaleWeight: 0.8`.
   - Behavior without inflation adjustment (`inflationAdjusted: false`).
   - Adversarial: `yaleWeight` out of bounds (e.g., `1.5` clamps to `1.0`, `-0.5` clamps to `0`).
   - Adversarial: `initialPortfolio: 0` (division by zero prevention).

4. **Main Delegator Tests (`describe('calculateSpending')`):**
   - Branches correctly to `constant_dollar`, `vanguard_dynamic`, and `yale_endowment`.

5. **Household Integration Tests (`describe('getHouseholdSpending')`):**
   - Correctly calculates `yearsElapsed` from household demographics (`birthYear: 1960`, `retirementAge: 65`, `currentYear: 2035` $\rightarrow$ `yearsElapsed: 10`).
   - Returns default zero output if `household.spending` is undefined.

---

## 5. Verification Method

Once the implementer completes the code for `src/lib/planner/spendingEngine.ts` and `__tests__/planner/spendingEngine.spec.ts`, verify the implementation using the following independent commands:

1. **Run Unit Tests:**
   ```bash
   npm run test __tests__/planner/spendingEngine.spec.ts
   ```
   *Expected Output:* 100% passing tests across all describe blocks.

2. **Run Full Planner Test Suite:**
   ```bash
   npm run test __tests__/planner
   ```
   *Expected Output:* All existing tests (`types.spec.ts`, `taxEngine.spec.ts`, `pensionEngine.spec.ts`, `spendingEngine.spec.ts`) pass successfully without regressions.

3. **Verify TypeScript Compilation:**
   ```bash
   npx tsc --noEmit
   ```
   *Expected Output:* Zero TypeScript compilation errors or type mismatches.
