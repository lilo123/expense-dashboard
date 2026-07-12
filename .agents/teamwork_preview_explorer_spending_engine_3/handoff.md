# Milestone 1.4: Spending Engine Exploration & Analysis Report

## 1. Observation
During our read-only investigation of the Financial Retirement Planner codebase, we observed the following architectural contracts, domain schemas, and engine conventions:

- **Project Scope (`PROJECT.md`, lines 7, 14, 22)**: Specifies pure business logic engines with Zod validation schemas in `src/lib/planner/types.ts`. Milestone 1 ("Core Domain Types & Pure Business Logic Engines") includes `spendingEngine.ts` and its unit tests, currently marked as `IN_PROGRESS`.
- **Milestone Scope (`SCOPE.md`, lines 8, 18, 23-24)**: Milestone 1.4 explicitly targets `src/lib/planner/spendingEngine.ts` and `__tests__/planner/spendingEngine.spec.ts`. The interface contract mandates that all engines import and use Zod schemas/inferred types from `types.ts`, and operate strictly as pure functions with zero side effects.
- **Domain Types (`src/lib/planner/types.ts`, lines 21-53)**: Defines `SpendingSchema` and the inferred `Spending` type:
  ```typescript
  export const SpendingSchema = z.object({
    initialBase: z.number().positive("Initial spending base must be positive"),
    strategy: z.enum(['constant_dollar', 'vanguard_dynamic', 'yale_endowment']),
    minWithdrawal: z.number().positive("Minimum withdrawal floor must be positive").optional(),
    maxWithdrawal: z.number().positive("Maximum withdrawal ceiling must be positive").optional(),
    yaleWeight: z.number().min(0).max(1, "Yale weight must be between 0 and 1").optional(),
    inflationAdjusted: z.boolean(),
  });
  ```
  Zod `.refine()` blocks enforce three invariants: `vanguard_dynamic` requires both `minWithdrawal` and `maxWithdrawal`; `minWithdrawal <= maxWithdrawal`; and `yale_endowment` requires `yaleWeight`.
- **Style Reference 1 (`src/lib/planner/taxEngine.ts`, lines 3-27, 368-373)**: Uses clean TypeScript input/output interfaces (`TaxInput`, `TaxOutput`), pure helper functions for specific tax regimes (`calculateUsTaxes`, `calculateCaTaxes`), and a main delegator function (`calculateTaxes`).
- **Style Reference 2 (`src/lib/planner/pensionEngine.ts`, lines 3-20, 128-130, 155-182)**: Uses `PensionInput` and `PensionOutput`. Calculates inflation compounding via `Math.pow(1 + inflationRate, Math.max(0, yearsElapsed))`. Features an aggregate helper `calculateAllPensions` that determines `yearsElapsed = currentYear - (birthYear + retirementAge)`.
- **Existing Test Coverage (`__tests__/planner/types.spec.ts` lines 51-81, `__tests__/planner/adv_types.spec.ts` lines 103-134)**: Validates standard and adversarial Zod parsing of `SpendingSchema`, ensuring invalid configurations (e.g. `minWithdrawal > maxWithdrawal`, missing weights) fail at the schema boundary before reaching business logic engines.

## 2. Logic Chain
To achieve 100% test coverage and adhere perfectly to the pure function, zero-side-effect architecture, the implementation of `spendingEngine.ts` must follow a rigorous, step-by-step mathematical and architectural translation of the observations:

1. **Interface Symmetry**: Following `taxEngine.ts` and `pensionEngine.ts`, `spendingEngine.ts` must export clear `SpendingInput` and `SpendingOutput` interfaces. `SpendingInput` must receive the `Spending` object, `yearsElapsed`, `inflationRate`, `initialPortfolioBalance`, `currentPortfolioBalance`, and an optional `priorYearWithdrawal`. `SpendingOutput` must return the `strategy`, `initialBase`, `targetWithdrawal`, `inflationFactor`, and strategy-specific intermediate components (`unconstrainedWithdrawal`, `floor`, `ceiling`, `stabilityComponent`, `marketComponent`).
2. **Inflation Compounding Parity**: Following `pensionEngine.ts` (lines 128-130), the inflation factor must be calculated identically across all spending rules:
   ```typescript
   const inflationFactor = spending.inflationAdjusted ? Math.pow(1 + inflationRate, Math.max(0, yearsElapsed)) : 1.0;
   ```
3. **Constant Dollar Mechanics (`constant_dollar`)**: The baseline spending is `initialBase`. The annual target withdrawal is simply `initialBase * inflationFactor`.
4. **Vanguard Dynamic Mechanics (`vanguard_dynamic`)**:
   - Establish the initial withdrawal rate: `const initialRate = initialPortfolioBalance > 0 ? spending.initialBase / initialPortfolioBalance : 0;`.
   - Calculate the unconstrained withdrawal from current assets: `const unconstrained = currentPortfolioBalance * initialRate;`. (If `initialPortfolioBalance <= 0`, fallback to `spending.initialBase * inflationFactor`).
   - Apply inflation adjustments to the floor and ceiling: `const floor = (spending.minWithdrawal ?? 0) * inflationFactor;` and `const ceiling = (spending.maxWithdrawal ?? Infinity) * inflationFactor;`.
   - Clamp the unconstrained withdrawal: `const targetWithdrawal = Math.max(floor, Math.min(unconstrained, ceiling));`.
5. **Yale Endowment Mechanics (`yale_endowment`)**:
   - Establish the weighting factor: `const weight = spending.yaleWeight ?? 0.7;`.
   - Calculate the Stability Component: If `yearsElapsed === 0` or `priorYearWithdrawal` is missing/non-positive, fallback to `spending.initialBase * inflationFactor`. Otherwise, adjust the prior year's withdrawal by one year of inflation: `priorYearWithdrawal * (spending.inflationAdjusted ? (1 + inflationRate) : 1.0)`.
   - Calculate the Market Component: `const marketComponent = currentPortfolioBalance * (initialPortfolioBalance > 0 ? spending.initialBase / initialPortfolioBalance : 0);`.
   - Combine components: `const targetWithdrawal = weight * stabilityComponent + (1 - weight) * marketComponent;`.
6. **Aggregate Helper**: Implement `calculateHouseholdSpending(household: Household, currentYear: number, inflationRate: number, currentPortfolioBalance: number, initialPortfolioBalance: number, priorYearWithdrawal?: number): SpendingOutput | null` to calculate `yearsElapsed = currentYear - (household.birthYear + household.retirementAge)` and delegate to `calculateSpendingWithdrawal(input)`.
7. **Comprehensive Test Suite Strategy**: To ensure 100% test coverage in `__tests__/planner/spendingEngine.spec.ts`, the test file must be structured into three distinct suites:
   - *Happy Path*: Testing each strategy with/without inflation, checking floor/ceiling clamps in bull/bear markets, testing Yale weighted combinations, and validating `calculateHouseholdSpending`.
   - *Boundary Cases*: `yearsElapsed <= 0`, `inflationRate === 0`, `initialPortfolioBalance === 0`, `currentPortfolioBalance === 0`, `yaleWeight === 0` or `1`, `minWithdrawal === maxWithdrawal`, and `household.spending === undefined`.
   - *Adversarial Testing*: Direct invocation with missing optional parameters in `Spending` (bypassing Zod), extreme `yearsElapsed` (e.g. 1000), hyperinflation (`inflationRate: 10.0`), negative `priorYearWithdrawal`, negative balances, and `NaN`/`Infinity` resilience.

## 3. Caveats
- **Drawdown Engine Interaction**: The Spending Engine is responsible solely for determining the *target* withdrawal amount (`targetWithdrawal`) for a given year. It does not execute the actual deduction of funds from accounts or handle asset depletion; that responsibility lies with `drawdownEngine.ts`.
- **Zod Bypass Assumption**: While `types.ts` enforces strict validation on `SpendingSchema`, the pure functions in `spendingEngine.ts` must be designed defensively with robust fallbacks (e.g. `minWithdrawal ?? 0`, `yaleWeight ?? 0.7`) to ensure safety even if invoked directly in a non-TypeScript or unvalidated context.
- **Deflation Handling**: The engine assumes `inflationRate` can be negative (deflation), which would correctly reduce nominal withdrawals if `inflationAdjusted` is true. If a nominal floor is desired during deflation, it would need to be handled explicitly, but standard economic models allow nominal adjustments downward.

## 4. Conclusion
The Spending Engine (`src/lib/planner/spendingEngine.ts`) can be elegantly implemented as a pure TypeScript module with zero side effects, perfectly matching the architectural style of `taxEngine.ts` and `pensionEngine.ts`. 

### Recommended Pure Function Contract (`src/lib/planner/spendingEngine.ts`)
```typescript
import { Spending, Household } from './types';

export interface SpendingInput {
  spending: Spending;
  yearsElapsed: number;
  inflationRate: number;
  initialPortfolioBalance: number;
  currentPortfolioBalance: number;
  priorYearWithdrawal?: number;
}

export interface SpendingOutput {
  strategy: Spending['strategy'];
  initialBase: number;
  targetWithdrawal: number;
  inflationFactor: number;
  unconstrainedWithdrawal?: number;
  floor?: number;
  ceiling?: number;
  stabilityComponent?: number;
  marketComponent?: number;
}

export function calculateConstantDollar(input: SpendingInput): SpendingOutput { /* ... */ }
export function calculateVanguardDynamic(input: SpendingInput): SpendingOutput { /* ... */ }
export function calculateYaleEndowment(input: SpendingInput): SpendingOutput { /* ... */ }

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
  currentYear: number,
  inflationRate: number,
  currentPortfolioBalance: number,
  initialPortfolioBalance: number,
  priorYearWithdrawal?: number
): SpendingOutput | null { /* ... */ }
```

## 5. Verification Method
Once the implementer completes `src/lib/planner/spendingEngine.ts` and `__tests__/planner/spendingEngine.spec.ts`, the following verification steps must be executed to confirm success:

1. **Unit Test Execution & 100% Coverage Verification**:
   ```bash
   npm run test __tests__/planner/spendingEngine.spec.ts
   ```
   *Success Condition*: All tests pass (Happy Path, Boundary Cases, Adversarial Testing) with 100% statement, branch, function, and line coverage.
2. **Global Suite Regression Check**:
   ```bash
   npm run test __tests__/planner
   ```
   *Success Condition*: Existing tests (`types.spec.ts`, `taxEngine.spec.ts`, `pensionEngine.spec.ts`) and the new spending engine tests pass successfully.
3. **TypeScript Build & Static Analysis**:
   ```bash
   npm run build
   ```
   *Success Condition*: Clean TypeScript compilation with zero errors or warnings, verifying complete type safety and correct Zod integration.
