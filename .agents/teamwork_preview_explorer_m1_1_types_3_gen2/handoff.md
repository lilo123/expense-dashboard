# Milestone 1.1 (Zod Schemas & Domain Types) — Iteration 2 Explorer Analysis & Implementation Plan

## Executive Summary
This report synthesizes the findings from existing baseline tests, adversarial test audits (Challenger 1 and Challenger 2), and PRD specifications. The current Zod schemas in `src/lib/planner/types.ts` satisfy basic happy-path validation but fail 11 adversarial test cases due to missing PRD domain properties, lack of URL query string coercion, missing cross-field invariants, and unbounded simulation parameters. This handoff provides the exact, production-grade Zod schema replacements required to make both test suites pass 100%.

---

## 1. Observation

### Exact File Paths & Inspection Targets
- **Implementation File**: `/usr/local/google/home/duynguyenn/expense-dashboard/src/lib/planner/types.ts` (Lines 1–103)
- **Baseline Test Suite**: `/usr/local/google/home/duynguyenn/expense-dashboard/__tests__/planner/types.spec.ts` (Lines 1–275)
- **Adversarial Test Suite**: `/usr/local/google/home/duynguyenn/expense-dashboard/__tests__/planner/adv_types.spec.ts` (Lines 1–173)
- **PRD Specifications**: `/usr/local/google/home/duynguyenn/expense-dashboard/docs/PRD_RETIREMENT_PLANNER.md`
- **Challenger 1 Report**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m1_1_types_1/handoff.md`
- **Challenger 2 Report**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_challenger_m1_1_types_2/handoff.md`

### Verbatim Errors & Test Failures Observed
Executing `npm run test __tests__/planner/adv_types.spec.ts` yields 11 failing adversarial tests across 8 schema domains:

1. **`QuickCheckParamsSchema` (`types.ts:96-102`)**:
   - *Test*: `adv_quickcheck_url_coercion: should successfully parse string values from URLSearchParams hydration`
   - *Verbatim Error*: `[{"expected":"number","code":"invalid_type","path":["portfolio"],"message":"Invalid input: expected number, received string"}, ...]`
   - *Direct Observation*: Schema uses `z.number()` instead of `z.coerce.number()`.

2. **`LifeEventSchema` (`types.ts:38-46`)**:
   - *Test*: `adv_lifeevent_start_end_years: should successfully parse multi-year life event with start/end years as per PRD`
   - *Verbatim Error*: `[{"expected":"number","code":"invalid_type","path":["age"],"message":"Invalid input: expected number, received undefined"}]`
   - *Direct Observation*: Schema mandates `age: z.number()` and lacks `startYear` / `endYear` support.

3. **`HouseholdSchema` (`types.ts:60-76`)**:
   - *Test*: `adv_household_inclusion_and_horizon: should retain partner inclusion toggle and simulation horizon mode as per PRD`
   - *Verbatim Error*: `Expected path: "includeSpouse" Received path: []`
   - *Test*: `adv_household_spouse_asset_consistency: should fail if accounts or pensions belong to spouse but no spouse is defined in household`
   - *Verbatim Error*: `Received function did not throw`
   - *Direct Observation*: Omits `includeSpouse` and `horizonMode`, and lacks `.refine()` cross-field validation for spouse asset ownership.

4. **`AccountSchema` (`types.ts:4-12`)**:
   - *Test*: `adv_account_asset_allocation: should retain asset allocation sliders (Stocks/Bonds/Cash) as per PRD`
   - *Verbatim Error*: `Expected path: "assetAllocation" Received path: []`
   - *Direct Observation*: Omits `assetAllocation` object, causing Zod to strip the property.

5. **`SpendingSchema` (`types.ts:16-24`)**:
   - *Test*: `adv_spending_vanguard_floor_ceiling_invariant: should fail if minWithdrawal > maxWithdrawal (floor exceeds ceiling)`
   - *Verbatim Error*: `Received function did not throw`
   - *Test*: `adv_spending_vanguard_required_clamps: should fail if strategy is vanguard_dynamic but minWithdrawal or maxWithdrawal is missing`
   - *Verbatim Error*: `Received function did not throw`
   - *Test*: `adv_spending_yale_required_weight: should fail if strategy is yale_endowment but yaleWeight is missing`
   - *Verbatim Error*: `Received function did not throw`
   - *Direct Observation*: Lacks `.refine()` checks to enforce strategy-specific parameter requirements and floor <= ceiling invariants.

6. **`SimulationResultsSummarySchema` (`types.ts:79-93`)**:
   - *Test*: `adv_simulation_results_percentile_invariant: should fail if final balance percentiles violate p10 <= p50 <= p90`
   - *Verbatim Error*: `Received function did not throw`
   - *Direct Observation*: Lacks `.refine()` check for percentile order invariants.

7. **`SimulationConfigSchema` (`types.ts:49-57`)**:
   - *Test*: `adv_simulation_config_oom_protection: should fail if numPaths exceeds safe execution limits (e.g. > 10000)`
   - *Verbatim Error*: `Received function did not throw`
   - *Direct Observation*: `numPaths` uses `z.number().int().positive()` without a `.max(10000)` ceiling.

8. **`PensionSchema` (`types.ts:27-35`)**:
   - *Test*: `adv_pension_statutory_age_bounds: should fail if Social Security startAge is below statutory minimum (62)`
   - *Verbatim Error*: `Received function did not throw`
   - *Direct Observation*: `startAge` allows down to age 50 without conditionally restricting `social_security` to >= 62.

---

## 2. Logic Chain

1. **Hydration Coercion Necessity**: During CUJ 2 hydration, URL search parameters (`?portfolio=1M&withdrawal=4&years=30`) are natively extracted as strings. Using `z.number()` causes Zod to throw an `invalid_type` error. Applying `z.coerce.number()` allows seamless, robust conversion from URL query parameters while preserving direct numerical parsing for in-memory store calls.
2. **PRD Alignment & Prevention of Property Stripping**: Zod objects strip unrecognized properties by default. Because `PRD_RETIREMENT_PLANNER.md` mandates asset allocation sliders (`assetAllocation`), partner inclusion toggles (`includeSpouse`), horizon modes (`horizonMode`), and multi-year life events (`startYear`/`endYear`), omitting them from `types.ts` breaks the persistence and state hydration layers. Adding them as explicit optional/defaulted fields preserves backward compatibility with `types.spec.ts` while satisfying `adv_types.spec.ts`.
3. **Cross-Field Invariants for Simulation Integrity**: Downstream Web Worker simulation engines rely on valid mathematical inputs. Allowing `minWithdrawal > maxWithdrawal`, inverted percentiles (`p10 > p50 > p90`), or missing strategy weights causes silent calculation corruption or runtime exceptions. Adding explicit `.refine()` blocks guarantees that invalid states are blocked at the Zod validation boundary.
4. **Defensive Upper Bounds for OOM Protection**: Because `SimulationConfig` is passed directly to client-side Web Workers, an unbounded `numPaths` parameter (e.g., `1,000,000,000`) exposes the browser to severe lockups and Out-Of-Memory crashes. Enforcing `.max(10000)` on `numPaths` and `.max(100)` on `retirementHorizon` establishes an essential defense-in-depth barrier.

---

## 3. Caveats

- **Scope Limitation**: This investigation is strictly read-only and confined to `src/lib/planner/types.ts`, `__tests__/planner/types.spec.ts`, and `__tests__/planner/adv_types.spec.ts`. Downstream business logic engines (`taxEngine.ts`, `pensionEngine.ts`, etc.) and Zustand stores were not executed or modified.
- **Assumptions**: We assume `QuickCheckParamsSchema` is directly used on raw URL query objects as specified in the PRD and architecture documents. The proposed schema changes maintain full compatibility with both raw strings and pre-parsed numbers.

---

## 4. Conclusion

**Overall Assessment: Actionable Implementation Plan Ready**

To resolve all 11 adversarial test failures while maintaining 100% passing status on the baseline test suite, the implementer must replace the contents of `src/lib/planner/types.ts` with the fully refined Zod schemas and exported TypeScript types detailed below.

### Proposed Replacement Content for `src/lib/planner/types.ts`

```typescript
import { z } from 'zod';

// 1. Account Schema
export const AccountSchema = z.object({
  id: z.string().min(1, "Account ID is required"),
  name: z.string().min(1, "Account name is required"),
  type: z.enum(['taxable', 'tax_deferred', 'tax_free']),
  balance: z.number().nonnegative("Balance must be non-negative"),
  costBasis: z.number().nonnegative("Cost basis must be non-negative"),
  expectedReturnOverride: z.number().optional(),
  owner: z.enum(['primary', 'spouse', 'joint']),
  assetAllocation: z.object({
    stocks: z.number(),
    bonds: z.number(),
    cash: z.number(),
  }).optional(),
});
export type Account = z.infer<typeof AccountSchema>;

// 2. Spending Schema
export const SpendingSchema = z.object({
  initialBase: z.number().positive("Initial spending base must be positive"),
  strategy: z.enum(['constant_dollar', 'vanguard_dynamic', 'yale_endowment']),
  minWithdrawal: z.number().positive("Minimum withdrawal floor must be positive").optional(),
  maxWithdrawal: z.number().positive("Maximum withdrawal ceiling must be positive").optional(),
  yaleWeight: z.number().min(0).max(1, "Yale weight must be between 0 and 1").optional(),
  inflationAdjusted: z.boolean(),
})
.refine(data => {
  if (data.strategy === 'vanguard_dynamic') {
    return data.minWithdrawal !== undefined && data.maxWithdrawal !== undefined;
  }
  return true;
}, { message: "vanguard_dynamic strategy requires minWithdrawal and maxWithdrawal", path: ["strategy"] })
.refine(data => {
  if (data.minWithdrawal !== undefined && data.maxWithdrawal !== undefined) {
    return data.minWithdrawal <= data.maxWithdrawal;
  }
  return true;
}, { message: "Minimum withdrawal floor cannot exceed ceiling", path: ["minWithdrawal"] })
.refine(data => {
  if (data.strategy === 'yale_endowment') {
    return data.yaleWeight !== undefined;
  }
  return true;
}, { message: "yale_endowment strategy requires yaleWeight", path: ["yaleWeight"] });
export type Spending = z.infer<typeof SpendingSchema>;

// 3. Pension Schema
export const PensionSchema = z.object({
  id: z.string().min(1, "Pension ID is required"),
  owner: z.enum(['primary', 'spouse']),
  type: z.enum(['social_security', 'cpp', 'oas', 'defined_benefit']),
  baseAmount: z.number().nonnegative("Base amount must be non-negative"),
  startAge: z.number().min(50).max(80, "Start age must be between 50 and 80"),
  inflationAdjusted: z.boolean(),
}).refine(data => !(data.type === 'social_security' && data.startAge < 62), {
  message: "Social Security cannot be claimed before age 62",
  path: ["startAge"],
});
export type Pension = z.infer<typeof PensionSchema>;

// 4. LifeEvent Schema
export const LifeEventSchema = z.object({
  id: z.string().min(1, "Life event ID is required"),
  name: z.string().min(1, "Life event name is required"),
  age: z.number().positive("Age must be positive").optional(),
  startYear: z.number().int().positive().optional(),
  endYear: z.number().int().positive().optional(),
  type: z.enum(['expense', 'income']),
  amount: z.number().positive("Amount must be positive"),
  inflationAdjusted: z.boolean(),
}).refine(data => data.age !== undefined || (data.startYear !== undefined && data.endYear !== undefined), {
  message: "Either age or both startYear and endYear must be provided",
});
export type LifeEvent = z.infer<typeof LifeEventSchema>;

// 5. SimulationConfig Schema
export const SimulationConfigSchema = z.object({
  drawdownStrategy: z.enum(['taxable_first', 'proportional', 'tax_deferred_first']),
  historicalRange: z.enum(['most_recent_20_years', 'most_recent_50_years', 'all_125_years']),
  numPaths: z.number().int().positive().max(10000).default(1000),
  inflationRate: z.number().nonnegative().default(0.025),
  retirementHorizon: z.number().int().positive().max(100).default(30),
  seed: z.number().int().optional(),
});
export type SimulationConfig = z.infer<typeof SimulationConfigSchema>;

// 6. Household Schema
export const HouseholdSchema = z.object({
  id: z.string().optional(),
  user_id: z.string().optional(),
  name: z.string().min(1, "Household name is required"),
  taxJurisdiction: z.enum(['US', 'CA']),
  stateProvince: z.string().min(1, "State or province is required"),
  birthYear: z.number().int().min(1900).max(2100),
  retirementAge: z.number().int().min(50).max(80),
  spouseBirthYear: z.number().int().min(1900).max(2100).optional(),
  spouseRetirementAge: z.number().int().min(50).max(80).optional(),
  includeSpouse: z.boolean().default(false),
  horizonMode: z.enum(['fixed_years', 'life_expectancy']).default('fixed_years'),
  accounts: z.array(AccountSchema).optional(),
  spending: SpendingSchema.optional(),
  pensions: z.array(PensionSchema).optional(),
  lifeEvents: z.array(LifeEventSchema).optional(),
  simulationConfig: SimulationConfigSchema.optional(),
}).refine(data => {
  const hasSpouse = data.includeSpouse || data.spouseBirthYear !== undefined || data.spouseRetirementAge !== undefined;
  const hasSpouseAccount = data.accounts?.some(acc => acc.owner === 'spouse');
  const hasSpousePension = data.pensions?.some(pen => pen.owner === 'spouse');
  if (!hasSpouse && (hasSpouseAccount || hasSpousePension)) {
    return false;
  }
  return true;
}, { message: "Accounts or pensions cannot belong to spouse if no spouse is defined in household" });
export type Household = z.infer<typeof HouseholdSchema>;

// 7. SimulationResultsSummary Schema
export const SimulationResultsSummarySchema = z.object({
  successRate: z.number().min(0).max(100),
  medianFinalBalance: z.number(),
  tenthPercentileFinalBalance: z.number(),
  ninetiethPercentileFinalBalance: z.number(),
  annualEndingBalances: z.array(
    z.object({
      year: z.number().int(),
      p10: z.number(),
      p50: z.number(),
      p90: z.number(),
    })
  ).optional(),
}).refine(data => data.tenthPercentileFinalBalance <= data.medianFinalBalance && data.medianFinalBalance <= data.ninetiethPercentileFinalBalance, {
  message: "Percentiles must satisfy tenthPercentileFinalBalance <= medianFinalBalance <= ninetiethPercentileFinalBalance",
});
export type SimulationResultsSummary = z.infer<typeof SimulationResultsSummarySchema>;

// 8. QuickCheckParams Schema
export const QuickCheckParamsSchema = z.object({
  portfolio: z.coerce.number().nonnegative("Portfolio must be non-negative"),
  withdrawal: z.coerce.number().positive("Withdrawal must be positive"),
  years: z.coerce.number().int().positive("Years must be positive"),
  taxJurisdiction: z.enum(['US', 'CA']).optional(),
});
export type QuickCheckParams = z.infer<typeof QuickCheckParamsSchema>;
```

---

## 5. Verification Method

To verify the successful resolution of all issues once the implementer applies the changes to `src/lib/planner/types.ts`, execute the following commands from the project root:

### 1. Baseline Test Verification (Ensure No Regressions)
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
npm run test __tests__/planner/types.spec.ts
```
- **Expected Output**: `PASS __tests__/planner/types.spec.ts` (19 passed, 19 total).

### 2. Adversarial Test Verification (Ensure 100% Resolution)
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
npm run test __tests__/planner/adv_types.spec.ts
```
- **Expected Output**: `PASS __tests__/planner/adv_types.spec.ts` (11 passed, 11 total).
- **Invalidation Condition**: Any failing test indicates an incomplete schema refinement or missing property definition.
