# Handoff Report — Milestone 1.1 (Zod Schemas & Domain Types) Enhancement Plan

## Summary of Core Findings
The current Zod schemas in `src/lib/planner/types.ts` successfully pass the baseline happy-path test suite (`__tests__/planner/types.spec.ts`) but fail all 11 adversarial test cases (`__tests__/planner/adv_types.spec.ts`). By synthesizing the findings from Challenger 1 and Challenger 2 with direct whitebox code inspection, we have formulated a complete, drop-in enhancement plan for `types.ts` that introduces URL parameter coercion (`z.coerce`), missing PRD domain fields (`assetAllocation`, `startYear`, `endYear`, `includeSpouse`, `horizonMode`), cross-field invariant refinements (`floor <= ceiling`, `p10 <= p50 <= p90`, spouse asset consistency), and defensive OOM upper bounds (`numPaths.max(10000)`).

---

## 1. Observation

### Exact File Paths & Inspection Targets
- **Domain Types & Schemas**: `src/lib/planner/types.ts`
- **Baseline Test Suite**: `__tests__/planner/types.spec.ts`
- **Adversarial Test Suite**: `__tests__/planner/adv_types.spec.ts`
- **PRD Specifications**: `docs/PRD_RETIREMENT_PLANNER.md`
- **Challenger Reports**: `.agents/teamwork_preview_challenger_m1_1_types_1/handoff.md` and `.agents/teamwork_preview_challenger_m1_1_types_2/handoff.md`

### Verbatim Errors & Direct Observations
1. **QuickCheckParamsSchema (`types.ts:96-102`)**:
   - *Current Code*: `portfolio: z.number().nonnegative()`, `withdrawal: z.number().positive()`, `years: z.number().int().positive()`.
   - *Adversarial Test Failure*: `adv_quickcheck_url_coercion` fails with `ZodError: [{"expected":"number","code":"invalid_type","path":["portfolio"],"message":"Invalid input: expected number, received string"}, ...]` when parsing `{ portfolio: '1000000', withdrawal: '4', years: '30' }`.
2. **LifeEventSchema (`types.ts:38-46`)**:
   - *Current Code*: `age: z.number().positive()`. Lacks `startYear` and `endYear`.
   - *Adversarial Test Failure*: `adv_lifeevent_start_end_years` fails with `ZodError: [{"expected":"number","code":"invalid_type","path":["age"],"message":"Invalid input: expected number, received undefined"}]` when parsing multi-year events like College Tuition (`startYear: 2026, endYear: 2030`).
3. **HouseholdSchema (`types.ts:60-76`)**:
   - *Current Code*: Omits `includeSpouse` and `horizonMode`. Lacks cross-field validation for spouse-owned assets.
   - *Adversarial Test Failures*: `adv_household_inclusion_and_horizon` fails with `Expected path: "includeSpouse" Received path: []`. `adv_household_spouse_asset_consistency` fails with `Received function did not throw` when passing an account with `owner: 'spouse'` in a single household.
4. **AccountSchema (`types.ts:4-12`)**:
   - *Current Code*: Omits `assetAllocation`.
   - *Adversarial Test Failure*: `adv_account_asset_allocation` fails with `Expected path: "assetAllocation" Received path: []`.
5. **SpendingSchema (`types.ts:16-24`)**:
   - *Current Code*: Lacks `.refine()` checks for `minWithdrawal <= maxWithdrawal`, required clamps for `vanguard_dynamic`, and required `yaleWeight` for `yale_endowment`.
   - *Adversarial Test Failures*: `adv_spending_vanguard_floor_ceiling_invariant`, `adv_spending_vanguard_required_clamps`, and `adv_spending_yale_required_weight` all fail with `Received function did not throw`.
6. **SimulationResultsSummarySchema (`types.ts:79-93`)**:
   - *Current Code*: Lacks `.refine()` check for `tenthPercentileFinalBalance <= medianFinalBalance <= ninetiethPercentileFinalBalance`.
   - *Adversarial Test Failure*: `adv_simulation_results_percentile_invariant` fails with `Received function did not throw` when parsing inverted percentiles (`p10: 5000000, p50: 2000000, p90: 1000000`).
7. **SimulationConfigSchema (`types.ts:49-57`)**:
   - *Current Code*: `numPaths: z.number().int().positive().default(1000)`. Lacks `.max()`.
   - *Adversarial Test Failure*: `adv_simulation_config_oom_protection` fails with `Received function did not throw` when passing `numPaths: 1000000000`.
8. **PensionSchema (`types.ts:27-35`)**:
   - *Current Code*: `startAge: z.number().min(50).max(80)`.
   - *Adversarial Test Failure*: `adv_pension_statutory_age_bounds` fails with `Received function did not throw` when passing `type: 'social_security', startAge: 52`.

---

## 2. Logic Chain

1. **URL Parameter Coercion**: `QuickCheckParamsSchema` is designed for URL query string hydration (`?portfolio=1M&withdrawal=4&years=30`). Because `URLSearchParams` natively yields strings, strict `z.number()` validation rejects valid inputs. Using `z.coerce.number()` preserves type safety while automatically handling string-to-number hydration, satisfying both baseline and adversarial expectations.
2. **Multi-Year Life Event Range Support**: PRD §3.5 dictates supporting multi-year cash flows (e.g., 4 years of college tuition) using `startYear` and `endYear`. The baseline test suite supplies only `age`, while the adversarial test suite supplies `startYear` and `endYear` without `age`. Making `age`, `startYear`, and `endYear` optional satisfies both suites and accurately models both single-year and multi-year events.
3. **Missing PRD Fields & Zod Key Stripping**: `AccountSchema` and `HouseholdSchema` omit `assetAllocation`, `includeSpouse`, and `horizonMode`. Because Zod objects strip unrecognized keys by default, these properties are silently dropped during parsing. Adding `assetAllocation: z.object({ stocks: z.number(), bonds: z.number(), cash: z.number() }).optional()`, `includeSpouse: z.boolean().default(false)`, and `horizonMode: z.enum(['fixed_years', 'life_expectancy']).default('fixed_years')` perfectly aligns the schemas with PRD §3.1 and §3.2.
4. **Cross-Field Invariants & Consistency Enforcement**: Without `.refine()` blocks on `SpendingSchema`, `HouseholdSchema`, `PensionSchema`, and `SimulationResultsSummarySchema`, invalid domain states (such as Vanguard floor exceeding ceiling, missing strategy parameters, claiming Social Security before age 62, spouse-owned assets in single households, or inverted percentiles) pass validation. Adding explicit refinements guarantees that corrupt or mathematically impossible states are rejected before reaching the Web Worker simulation engine.
5. **Defensive Upper Bounds (OOM Protection)**: `SimulationConfigSchema` executes Monte Carlo bootstrap paths in a client-side Web Worker. An unbounded `numPaths` parameter allows malicious or malformed inputs (e.g., `1,000,000,000`) to cause severe memory exhaustion (OOM) or browser freezes. Clamping `numPaths` with `.max(10000)` and `retirementHorizon` with `.max(100)` establishes a robust defensive perimeter.

---

## 3. Caveats

- **Scope Limitation**: This investigation strictly focused on the Zod schemas and exported domain types in `src/lib/planner/types.ts`. Downstream consumers (such as Zustand stores, Web Workers, and Supabase server actions) were not executed or modified, as they belong to subsequent milestones.
- **Assumptions**: We assume `QuickCheckParamsSchema` is utilized directly on parsed `URLSearchParams` objects as indicated in the PRD and adversarial tests. The proposed `z.coerce.number()` provides full resilience whether the input is a string or already a number.

---

## 4. Conclusion

The existing implementation of `src/lib/planner/types.ts` contains 11 distinct validation gaps and missing PRD fields. To make both the baseline test suite (`types.spec.ts`) and the adversarial test suite (`adv_types.spec.ts`) fully pass, `src/lib/planner/types.ts` must be updated with the complete, fully refined Zod schema definitions below.

### Proposed Complete Content for `src/lib/planner/types.ts`

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
}).refine(data => {
  if (data.strategy === 'vanguard_dynamic') {
    return data.minWithdrawal !== undefined && data.maxWithdrawal !== undefined;
  }
  return true;
}, {
  message: "minWithdrawal and maxWithdrawal are required for vanguard_dynamic strategy",
  path: ['strategy'],
}).refine(data => {
  if (data.minWithdrawal !== undefined && data.maxWithdrawal !== undefined) {
    return data.minWithdrawal <= data.maxWithdrawal;
  }
  return true;
}, {
  message: "Minimum withdrawal floor cannot exceed ceiling",
  path: ['minWithdrawal'],
}).refine(data => {
  if (data.strategy === 'yale_endowment') {
    return data.yaleWeight !== undefined;
  }
  return true;
}, {
  message: "yaleWeight is required for yale_endowment strategy",
  path: ['yaleWeight'],
});
export type Spending = z.infer<typeof SpendingSchema>;

// 3. Pension Schema
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
  message: "Social Security cannot be claimed before age 62",
  path: ['startAge'],
});
export type Pension = z.infer<typeof PensionSchema>;

// 4. LifeEvent Schema
export const LifeEventSchema = z.object({
  id: z.string().min(1, "Life event ID is required"),
  name: z.string().min(1, "Life event name is required"),
  age: z.number().positive("Age must be positive").optional(),
  startYear: z.number().int().positive("Start year must be positive").optional(),
  endYear: z.number().int().positive("End year must be positive").optional(),
  type: z.enum(['expense', 'income']),
  amount: z.number().positive("Amount must be positive"),
  inflationAdjusted: z.boolean(),
});
export type LifeEvent = z.infer<typeof LifeEventSchema>;

// 5. SimulationConfig Schema
export const SimulationConfigSchema = z.object({
  drawdownStrategy: z.enum(['taxable_first', 'proportional', 'tax_deferred_first']),
  historicalRange: z.enum(['most_recent_20_years', 'most_recent_50_years', 'all_125_years']),
  numPaths: z.number().int().positive().max(10000, "Number of paths cannot exceed 10000").default(1000),
  inflationRate: z.number().nonnegative().default(0.025),
  retirementHorizon: z.number().int().positive().max(100, "Retirement horizon cannot exceed 100 years").default(30),
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
  const hasSpouseDefined = data.includeSpouse || data.spouseBirthYear !== undefined || data.spouseRetirementAge !== undefined;
  const hasSpouseAccounts = data.accounts?.some(acc => acc.owner === 'spouse');
  const hasSpousePensions = data.pensions?.some(pen => pen.owner === 'spouse');
  
  if (!hasSpouseDefined && (hasSpouseAccounts || hasSpousePensions)) {
    return false;
  }
  return true;
}, {
  message: "Cannot assign accounts or pensions to spouse if no spouse is defined in household",
  path: ['accounts'],
});
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
}).refine(data => {
  return data.tenthPercentileFinalBalance <= data.medianFinalBalance &&
         data.medianFinalBalance <= data.ninetiethPercentileFinalBalance;
}, {
  message: "Final balance percentiles must satisfy tenthPercentileFinalBalance <= medianFinalBalance <= ninetiethPercentileFinalBalance",
  path: ['tenthPercentileFinalBalance'],
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

To independently verify the success of the proposed implementation once applied, execute the following test commands from the project root:

1. **Verify Baseline Suite Passes** (confirm zero regressions):
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/types.spec.ts
   ```
   *Expected Output: PASS (19 passed, 19 total)*

2. **Verify Adversarial Suite Passes** (confirm all 11 gaps resolved):
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/adv_types.spec.ts -- --verbose
   ```
   *Expected Output: PASS (11 passed, 11 total)*

3. **Verify Complete Planner Test Coverage**:
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/
   ```
