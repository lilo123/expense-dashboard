# Exploration Report: Milestone 1.4 - Spending Engine & Unit Tests

**Summary of Core Findings**: The Spending Engine (`src/lib/planner/spendingEngine.ts`) and its unit tests (`__tests__/planner/spendingEngine.spec.ts`) are currently unwritten, aligning with `SCOPE.md` where M1.4 is marked as `PLANNED`. The engine must implement pure TypeScript business logic to compute annual retirement withdrawals across three distinct strategies (`constant_dollar`, `vanguard_dynamic`, `yale_endowment`), rigorously handling inflation compounding, division-by-zero protections, portfolio depletion clamping, and strict alignment with `SpendingSchema` in `types.ts`.

---

## 1. Observation

### Codebase Status
- **Missing Files**: Checked `src/lib/planner/spendingEngine.ts` and `__tests__/planner/spendingEngine.spec.ts` via `view_file`. Both returned `no such file or directory`. This directly confirms M1.4 is pending implementation.
- **Milestone Scope**: `SCOPE.md` (lines 12-20) specifies Milestone 1.4: Spending Engine (`src/lib/planner/spendingEngine.ts`, `__tests__/planner/spendingEngine.spec.ts`) is `PLANNED` and depends on M1.1 (Zod Schemas & Domain Types). It dictates that all engines must be pure functions with zero side effects.

### Domain Types & Zod Schemas (`src/lib/planner/types.ts`)
- **SpendingSchema** (lines 20-53):
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
  }, { message: "vanguard_dynamic strategy requires minWithdrawal and maxWithdrawal", path: ['strategy'] })
  .refine(data => {
    if (data.minWithdrawal !== undefined && data.maxWithdrawal !== undefined) {
      return data.minWithdrawal <= data.maxWithdrawal;
    }
    return true;
  }, { message: "minWithdrawal cannot exceed maxWithdrawal", path: ['minWithdrawal'] })
  .refine(data => {
    if (data.strategy === 'yale_endowment') {
      return data.yaleWeight !== undefined;
    }
    return true;
  }, { message: "yale_endowment strategy requires yaleWeight", path: ['yaleWeight'] });
  ```
- **HouseholdSchema** (lines 110-140): Embeds `spending: SpendingSchema.optional()`, `birthYear`, and `retirementAge`.

### Test Fixtures & Adversarial Audits (`__tests__/planner/types.spec.ts` & `adv_types.spec.ts`)
- `types.spec.ts` (lines 51-81) verifies parsing of `constant_dollar`, `vanguard_dynamic` with `minWithdrawal: 40000, maxWithdrawal: 60000`, and rejection of out-of-bounds `yaleWeight: 1.5`.
- `adv_types.spec.ts` (lines 103-134) verifies rejection of inverted floor/ceiling (`minWithdrawal: 60000, maxWithdrawal: 40000`) and missing required fields for `vanguard_dynamic` and `yale_endowment`.

### Existing Engines Design Pattern (`taxEngine.ts` & `pensionEngine.ts`)
- Both engines establish a strict architectural pattern:
  1. Define explicit input and output interfaces (`TaxInput`/`TaxOutput`, `PensionInput`/`PensionOutput`).
  2. Implement pure, modular helper functions for individual sub-calculations (e.g., `calculateProgressiveTax`, `calculateSocialSecurityAdjustment`).
  3. Provide a primary delegator function (`calculateTaxes`, `calculatePensionBenefit`) that branches cleanly based on strategy/type.
  4. Provide an optional household-level wrapper (`calculateAllPensions`) that extracts parameters from the `Household` aggregate root.

---

## 2. Logic Chain

### Step 1: Zod Schema Alignment & Interface Design
- **Reasoning**: Because `types.ts` exports the inferred `Spending` type and enforces invariants at the validation boundary (e.g., `minWithdrawal <= maxWithdrawal`, `0 <= yaleWeight <= 1`), the spending engine can assume these properties hold for valid `Spending` objects. However, to maintain pure function robustness, the engine should define explicit `SpendingInput` and `SpendingOutput` interfaces and include graceful fallbacks for missing optional properties.
- **Reference**: `types.ts` lines 20-53, `pensionEngine.ts` lines 3-20.

### Step 2: Inflation Compounding Mechanics (`yearsElapsed`)
- **Reasoning**: The boolean flag `spending.inflationAdjusted` determines whether baseline values grow over time. If `inflationAdjusted` is true, the compounding factor must be calculated as `Math.pow(1 + inflationRate, Math.max(0, yearsElapsed))`. If false, the factor is exactly `1.0`. Clamping `yearsElapsed` to `0` ensures that pre-retirement calculations do not discount the initial base.
- **Reference**: `pensionEngine.ts` lines 128-130 (`Math.pow(1 + inflationRate, Math.max(0, yearsElapsed))`).

### Step 3: Mechanics of `constant_dollar`
- **Reasoning**: Under `constant_dollar`, the retiree seeks a steady real income.
  - `targetWithdrawal = spending.initialBase * inflationFactor`.
  - `actualWithdrawal = Math.min(targetWithdrawal, Math.max(0, currentPortfolioBalance))`.
- **Reference**: `types.spec.ts` lines 52-59.

### Step 4: Mechanics of `vanguard_dynamic`
- **Reasoning**: Vanguard Dynamic Spending dynamically adjusts withdrawals based on market performance while guarding against extreme volatility using floors and ceilings.
  - *Unconstrained Withdrawal*: Calculated by applying the baseline withdrawal percentage to the current portfolio balance: `baseRate = initialPortfolioBalance > 0 ? spending.initialBase / initialPortfolioBalance : 0`. `unconstrainedWithdrawal = currentPortfolioBalance * baseRate`.
  - *Floor & Ceiling*: The absolute dollar floor (`minWithdrawal`) and ceiling (`maxWithdrawal`) must also be adjusted for inflation if `inflationAdjusted` is true: `effectiveMin = (spending.minWithdrawal ?? 0) * inflationFactor`, `effectiveMax = (spending.maxWithdrawal ?? Infinity) * inflationFactor`.
  - *Target Withdrawal*: `targetWithdrawal = Math.max(effectiveMin, Math.min(effectiveMax, unconstrainedWithdrawal))`.
  - *Actual Withdrawal*: Clamped by remaining portfolio balance: `actualWithdrawal = Math.min(targetWithdrawal, Math.max(0, currentPortfolioBalance))`.
- **Reference**: `types.spec.ts` lines 61-70.

### Step 5: Mechanics of `yale_endowment`
- **Reasoning**: The Yale Endowment model uses a weighted sum of a Stability Component (prior year spending) and a Market Component (current portfolio value).
  - *Weight*: `w = spending.yaleWeight ?? 0.7`.
  - *Stability Component*: If a `priorYearWithdrawal` is provided and `yearsElapsed > 0`, `stability = priorYearWithdrawal * (spending.inflationAdjusted ? (1 + inflationRate) : 1.0)`. If `priorYearWithdrawal` is omitted or `yearsElapsed === 0`, it defaults to `spending.initialBase * inflationFactor`.
  - *Market Component*: `baseRate = initialPortfolioBalance > 0 ? spending.initialBase / initialPortfolioBalance : 0`. `market = currentPortfolioBalance * baseRate`.
  - *Target Withdrawal*: `targetWithdrawal = w * stability + (1 - w) * market`.
  - *Actual Withdrawal*: `actualWithdrawal = Math.min(targetWithdrawal, Math.max(0, currentPortfolioBalance))`.
- **Reference**: `types.spec.ts` lines 72-80.

### Step 6: Mathematical Boundaries & Edge Cases
- **Reasoning**: To satisfy the adversarial hardening standards of the project, the engine must handle extreme inputs without throwing exceptions or returning `NaN`/`Infinity`:
  - *Zero/negative portfolio balance*: If `currentPortfolioBalance <= 0`, `actualWithdrawal = 0` and `isClampedByPortfolio = true` (if `targetWithdrawal > 0`).
  - *`minWithdrawal` > portfolio balance*: Even if the floor demands $40,000, if `currentPortfolioBalance` is $10,000, `actualWithdrawal` must clamp to $10,000, setting `isClampedByPortfolio = true`.
  - *`yaleWeight` extremes*: If `w = 1`, `targetWithdrawal = stability` (matches constant dollar behavior). If `w = 0`, `targetWithdrawal = market` (pure constant percentage behavior).
  - *Division by Zero Protection*: If `initialPortfolioBalance <= 0`, `baseRate` evaluates to `0` rather than `NaN` or `Infinity`.
- **Reference**: `PROJECT.md` lines 11-18 (Adversarial Coverage Hardening).

---

## 3. Caveats

- **Vanguard Dynamic Base Rate Assumption**: We assume the target withdrawal percentage for Vanguard Dynamic is derived dynamically as `initialBase / initialPortfolioBalance`. This perfectly captures the user's intended withdrawal rate at retirement inception. An alternative interpretation would be a hardcoded percentage (e.g., 4% or 5%), but deriving it from `initialBase` provides maximum flexibility and aligns with the Zod schema structure.
- **Yale Endowment Stability Baseline**: We assume `priorYearWithdrawal` will be supplied by the `simulator.ts` / `drawdownEngine.ts` during multi-year loops. In the absence of `priorYearWithdrawal` (e.g., Year 0), the formula falls back to `initialBase * inflationFactor`.

---

## 4. Conclusion

### Recommended Implementation Strategy & Pure Function Contract (`src/lib/planner/spendingEngine.ts`)

```typescript
import { Spending, Household } from './types';

export interface SpendingInput {
  spending: Spending;
  currentPortfolioBalance: number;
  initialPortfolioBalance: number;
  yearsElapsed: number;
  inflationRate: number;
  priorYearWithdrawal?: number;
}

export interface SpendingOutput {
  strategy: Spending['strategy'];
  targetWithdrawal: number; // Requested withdrawal before portfolio balance clamping
  actualWithdrawal: number; // Final withdrawal clamped by currentPortfolioBalance
  inflationFactor: number;
  isClampedByCeiling?: boolean; // For vanguard_dynamic: true if unconstrained > effectiveMax
  isClampedByFloor?: boolean; // For vanguard_dynamic: true if unconstrained < effectiveMin
  isClampedByPortfolio: boolean; // True if targetWithdrawal > currentPortfolioBalance
}

export function calculateConstantDollar(input: SpendingInput): SpendingOutput {
  const { spending, currentPortfolioBalance, yearsElapsed, inflationRate } = input;
  const inflationFactor = spending.inflationAdjusted
    ? Math.pow(1 + inflationRate, Math.max(0, yearsElapsed))
    : 1.0;

  const targetWithdrawal = spending.initialBase * inflationFactor;
  const clampedBalance = Math.max(0, currentPortfolioBalance);
  const actualWithdrawal = Math.min(targetWithdrawal, clampedBalance);

  return {
    strategy: 'constant_dollar',
    targetWithdrawal,
    actualWithdrawal,
    inflationFactor,
    isClampedByPortfolio: targetWithdrawal > clampedBalance,
  };
}

export function calculateVanguardDynamic(input: SpendingInput): SpendingOutput {
  const { spending, currentPortfolioBalance, initialPortfolioBalance, yearsElapsed, inflationRate } = input;
  const inflationFactor = spending.inflationAdjusted
    ? Math.pow(1 + inflationRate, Math.max(0, yearsElapsed))
    : 1.0;

  const baseRate = initialPortfolioBalance > 0 ? spending.initialBase / initialPortfolioBalance : 0;
  const unconstrainedWithdrawal = Math.max(0, currentPortfolioBalance) * baseRate;

  const effectiveMin = (spending.minWithdrawal ?? 0) * inflationFactor;
  const effectiveMax = (spending.maxWithdrawal ?? Infinity) * inflationFactor;

  let targetWithdrawal = unconstrainedWithdrawal;
  let isClampedByFloor = false;
  let isClampedByCeiling = false;

  if (unconstrainedWithdrawal < effectiveMin) {
    targetWithdrawal = effectiveMin;
    isClampedByFloor = true;
  } else if (unconstrainedWithdrawal > effectiveMax) {
    targetWithdrawal = effectiveMax;
    isClampedByCeiling = true;
  }

  const clampedBalance = Math.max(0, currentPortfolioBalance);
  const actualWithdrawal = Math.min(targetWithdrawal, clampedBalance);

  return {
    strategy: 'vanguard_dynamic',
    targetWithdrawal,
    actualWithdrawal,
    inflationFactor,
    isClampedByFloor,
    isClampedByCeiling,
    isClampedByPortfolio: targetWithdrawal > clampedBalance,
  };
}

export function calculateYaleEndowment(input: SpendingInput): SpendingOutput {
  const { spending, currentPortfolioBalance, initialPortfolioBalance, yearsElapsed, inflationRate, priorYearWithdrawal } = input;
  const inflationFactor = spending.inflationAdjusted
    ? Math.pow(1 + inflationRate, Math.max(0, yearsElapsed))
    : 1.0;

  const w = spending.yaleWeight ?? 0.7;

  let stabilityComponent: number;
  if (priorYearWithdrawal !== undefined && yearsElapsed > 0) {
    stabilityComponent = priorYearWithdrawal * (spending.inflationAdjusted ? (1 + inflationRate) : 1.0);
  } else {
    stabilityComponent = spending.initialBase * inflationFactor;
  }

  const baseRate = initialPortfolioBalance > 0 ? spending.initialBase / initialPortfolioBalance : 0;
  const marketComponent = Math.max(0, currentPortfolioBalance) * baseRate;

  const targetWithdrawal = w * stabilityComponent + (1 - w) * marketComponent;
  const clampedBalance = Math.max(0, currentPortfolioBalance);
  const actualWithdrawal = Math.min(targetWithdrawal, clampedBalance);

  return {
    strategy: 'yale_endowment',
    targetWithdrawal,
    actualWithdrawal,
    inflationFactor,
    isClampedByPortfolio: targetWithdrawal > clampedBalance,
  };
}

export function calculateSpendingWithdrawal(input: SpendingInput): SpendingOutput {
  if (input.spending.strategy === 'vanguard_dynamic') {
    return calculateVanguardDynamic(input);
  } else if (input.spending.strategy === 'yale_endowment') {
    return calculateYaleEndowment(input);
  }
  return calculateConstantDollar(input);
}

export function calculateHouseholdSpending(
  household: Household,
  currentPortfolioBalance: number,
  initialPortfolioBalance: number,
  currentYear: number,
  inflationRate: number,
  priorYearWithdrawal?: number
): SpendingOutput | null {
  if (!household.spending) {
    return null;
  }

  const birthYear = household.birthYear;
  const retirementAge = household.retirementAge;
  const yearsElapsed = currentYear - (birthYear + retirementAge);

  return calculateSpendingWithdrawal({
    spending: household.spending,
    currentPortfolioBalance,
    initialPortfolioBalance,
    yearsElapsed,
    inflationRate,
    priorYearWithdrawal,
  });
}
```

### Recommended Unit Test Specifications (`__tests__/planner/spendingEngine.spec.ts`)
The unit test file should comprehensively verify:
1. **Constant Dollar Tests**:
   - Standard withdrawal with and without inflation adjustment.
   - Negative `yearsElapsed` clamping to 0.
   - `targetWithdrawal > currentPortfolioBalance` clamping `actualWithdrawal` and setting `isClampedByPortfolio = true`.
2. **Vanguard Dynamic Tests**:
   - Unconstrained withdrawal staying within `[effectiveMin, effectiveMax]`.
   - Bull market scenario triggering `isClampedByCeiling = true`.
   - Bear market scenario triggering `isClampedByFloor = true`.
   - Severe depletion scenario where `effectiveMin > currentPortfolioBalance`, verifying `actualWithdrawal` clamps to `currentPortfolioBalance` and `isClampedByPortfolio = true`.
3. **Yale Endowment Tests**:
   - Verification of weighting mechanics (`yaleWeight: 0.7`) with and without `priorYearWithdrawal`.
   - Extreme `yaleWeight: 1` behaves identically to pure stability component.
   - Extreme `yaleWeight: 0` behaves identically to pure market component.
4. **Mathematical Boundaries & Robustness**:
   - `currentPortfolioBalance = 0` and `currentPortfolioBalance < 0` returning `actualWithdrawal = 0`.
   - `initialPortfolioBalance = 0` preventing division by zero (`NaN`/`Infinity`).
   - `calculateHouseholdSpending` returning `null` when `household.spending` is undefined.

---

## 5. Verification Method

### Independent Verification Commands
1. **Type & Schema Alignment Verification**:
   ```bash
   npx tsc --noEmit
   ```
   *Success Criteria*: Zero TypeScript compilation or type mismatch errors.

2. **Unit Test Verification**:
   ```bash
   npm run test __tests__/planner/spendingEngine.spec.ts
   ```
   *Success Criteria*: 100% passing tests across all describe blocks, verifying full statement and branch coverage.

### Invalidation Conditions
- Any changes to `SpendingSchema` in `src/lib/planner/types.ts` (e.g., adding new strategies or renaming properties like `yaleWeight`) would invalidate this contract and require updating `SpendingInput` / `SpendingOutput`.
