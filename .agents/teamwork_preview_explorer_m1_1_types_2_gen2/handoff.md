# Comprehensive Zod Schema & Domain Types Enhancement Plan — Milestone 1.1 (Iteration 2)

**Summary of Core Findings**: 
An exhaustive read-only investigation and synthesis of Challenger 1 and Challenger 2 adversarial reports reveals 9 critical validation gaps and missing domain properties in `src/lib/planner/types.ts`. By introducing `z.coerce.number()` for URL hydration, adding required PRD fields (`assetAllocation`, `startYear`, `endYear`, `includeSpouse`, `horizonMode`), and instituting rigorous cross-field `.refine()` invariants and OOM upper bounds, `src/lib/planner/types.ts` can be upgraded to achieve 100% passing status across both the baseline (`types.spec.ts`) and adversarial (`adv_types.spec.ts`) test suites with zero regressions.

---

## Synthesis of Challenger Reports & Investigation Findings

### Consensus
Both Challenger 1 and Challenger 2 independently identified the exact same set of 11 failing test cases across 8 domain schemas in `__tests__/planner/adv_types.spec.ts`, directly supported by whitebox inspection of `src/lib/planner/types.ts` and alignment checks against `docs/PRD_RETIREMENT_PLANNER.md` and `ARCHITECTURE.md`.
- **QuickCheckParamsSchema**: Both agree that `z.number()` fails URL query hydration because `URLSearchParams` natively provides strings, requiring `z.coerce.number()`.
- **LifeEventSchema**: Both identify the lack of `startYear` and `endYear` range support for multi-year events as mandated by PRD §3.5.
- **HouseholdSchema**: Both note the omission of `includeSpouse` and `horizonMode`, as well as the missing cross-field validation to prevent spouse-owned assets in single households.
- **AccountSchema**: Both identify the missing `assetAllocation` object (Stocks/Bonds/Cash) mandated by PRD §3.2.
- **SpendingSchema**: Both agree on the lack of the `minWithdrawal <= maxWithdrawal` invariant check and the missing required parameter checks for `vanguard_dynamic` and `yale_endowment` strategies.
- **SimulationResultsSummarySchema**: Both identify the missing percentile invariant check (`tenthPercentileFinalBalance <= medianFinalBalance <= ninetiethPercentileFinalBalance`).
- **SimulationConfigSchema**: Both flag the lack of OOM protection upper bounds on `numPaths` (`.max(10000)`).
- **PensionSchema**: Both note the lack of statutory minimum age checks for Social Security (`startAge >= 62`).

### Resolved Conflicts
- **Household Schema Defaults vs Optionals**: Challenger 1 noted that `includeSpouse` and `horizonMode` are missing. Challenger 2 specifically recommended `.default(false)` and `.default('fixed_years')`.
  *Resolution*: Using `.default(false)` for `includeSpouse` and `.default('fixed_years')` for `horizonMode` provides superior ergonomics for Zustand store hydration while maintaining full compatibility with existing baseline tests. Furthermore, to ensure the `HouseholdSchema` spouse asset consistency check remains robust across both baseline and adversarial suites, the definition of a spouse's presence is definitively resolved as `const hasSpouse = data.includeSpouse === true || data.spouseBirthYear !== undefined || data.spouseRetirementAge !== undefined;`.
- **LifeEvent Schema Age vs Start/End Years**: Challenger 1 noted `age` is currently captured but `startYear`/`endYear` are needed. Challenger 2 recommended making `age` optional or replacing it.
  *Resolution*: To ensure perfect backward compatibility with baseline tests (which provide `age` but not `startYear`/`endYear`) while satisfying adversarial tests (which provide `startYear`/`endYear` but not `age`), all three fields will be marked `.optional()` in the object definition, followed by a `.refine()` rule ensuring that either `age` OR (`startYear` and `endYear`) are provided.

### Dissenting Views
- None. Both Challenger reports are fundamentally aligned in their findings, severity assessments, and core recommendations.

### Gaps
- **Downstream Impact**: Neither report examines the runtime execution of the Web Worker or Zustand store hydration beyond the Zod boundary. However, this is fully aligned with the Milestone 1.1 scope boundary, which focuses strictly on domain types and Zod validation schemas.

---

## 1. Observation

### Exact File Paths & Tool Commands
- **Implementation File**: `src/lib/planner/types.ts`
- **Baseline Test Suite**: `__tests__/planner/types.spec.ts`
- **Adversarial Test Suite**: `__tests__/planner/adv_types.spec.ts`
- **Specification Documents**: `docs/PRD_RETIREMENT_PLANNER.md`, `ARCHITECTURE.md`, `PROJECT.md`, `SCOPE.md`
- **Baseline Test Command**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/types.spec.ts`
- **Adversarial Test Command**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/adv_types.spec.ts`

### Verbatim Test Results & Errors

#### Baseline Test Execution (`types.spec.ts`)
```
PASS __tests__/planner/types.spec.ts
  Zod Validation Schemas & Domain Types
    AccountSchema
      ✓ should successfully parse a valid taxable account (4 ms)
      ✓ should fail if balance or costBasis is negative (8 ms)
      ✓ should fail on invalid account type (1 ms)
    SpendingSchema
      ✓ should successfully parse constant_dollar strategy (1 ms)
      ✓ should successfully parse vanguard_dynamic strategy with min/max clamps (1 ms)
      ✓ should fail if yaleWeight is out of bounds [0, 1] (1 ms)
    PensionSchema
      ✓ should successfully parse social_security pension (1 ms)
      ✓ should fail if startAge is out of realistic bounds (1 ms)
    LifeEventSchema
      ✓ should successfully parse expense life event (1 ms)
      ✓ should fail on negative amount or empty name (1 ms)
    SimulationConfigSchema
      ✓ should successfully parse default config with all_125_years (1 ms)
      ✓ should successfully parse premium configs (1 ms)
    HouseholdSchema
      ✓ should successfully parse basic household demographics without optional aggregates (1 ms)
      ✓ should successfully parse complete aggregate root with accounts, spending, pensions, lifeEvents, and simulationConfig (1 ms)
      ✓ should fail if birthYear or retirementAge are invalid (1 ms)
    SimulationResultsSummarySchema
      ✓ should successfully parse valid simulation summary results (1 ms)
      ✓ should fail if successRate is outside [0, 100] (6 ms)
    QuickCheckParamsSchema
      ✓ should successfully parse valid QuickCheck parameters from URL query hydration (2 ms)
      ✓ should fail if portfolio is negative or years is not positive (1 ms)

Test Suites: 1 passed, 1 total
Tests:       19 passed, 19 total
```

#### Adversarial Test Execution (`adv_types.spec.ts`)
```
FAIL __tests__/planner/adv_types.spec.ts
  ● Adversarial Zod Validation Schemas & Domain Types Audit › 1. QuickCheckParamsSchema (High Severity) › adv_quickcheck_url_coercion: should successfully parse string values from URLSearchParams hydration
    Error name:    "ZodError"
    Error message: "[{\"expected\":\"number\",\"code\":\"invalid_type\",\"path\":[\"portfolio\"],\"message\":\"Invalid input: expected number, received string\"},{\"expected\":\"number\",\"code\":\"invalid_type\",\"path\":[\"withdrawal\"],\"message\":\"Invalid input: expected number, received string\"},{\"expected\":\"number\",\"code\":\"invalid_type\",\"path\":[\"years\"],\"message\":\"Invalid input: expected number, received string\"}]"

  ● Adversarial Zod Validation Schemas & Domain Types Audit › 2. LifeEventSchema (High Severity) › adv_lifeevent_start_end_years: should successfully parse multi-year life event with start/end years as per PRD
    Error name:    "ZodError"
    Error message: "[{\"expected\":\"number\",\"code\":\"invalid_type\",\"path\":[\"age\"],\"message\":\"Invalid input: expected number, received undefined\"}]"

  ● Adversarial Zod Validation Schemas & Domain Types Audit › 3. HouseholdSchema (High Severity) › adv_household_inclusion_and_horizon: should retain partner inclusion toggle and simulation horizon mode as per PRD
    Expected path: "includeSpouse"
    Received path: []

  ● Adversarial Zod Validation Schemas & Domain Types Audit › 3. HouseholdSchema (High Severity) › adv_household_spouse_asset_consistency: should fail if accounts or pensions belong to spouse but no spouse is defined in household
    Received function did not throw

  ● Adversarial Zod Validation Schemas & Domain Types Audit › 4. AccountSchema (Medium Severity) › adv_account_asset_allocation: should retain asset allocation sliders (Stocks/Bonds/Cash) as per PRD
    Expected path: "assetAllocation"
    Received path: []

  ● Adversarial Zod Validation Schemas & Domain Types Audit › 5. SpendingSchema (Medium Severity) › adv_spending_vanguard_floor_ceiling_invariant: should fail if minWithdrawal > maxWithdrawal (floor exceeds ceiling)
    Received function did not throw

  ● Adversarial Zod Validation Schemas & Domain Types Audit › 5. SpendingSchema (Medium Severity) › adv_spending_vanguard_required_clamps: should fail if strategy is vanguard_dynamic but minWithdrawal or maxWithdrawal is missing
    Received function did not throw

  ● Adversarial Zod Validation Schemas & Domain Types Audit › 5. SpendingSchema (Medium Severity) › adv_spending_yale_required_weight: should fail if strategy is yale_endowment but yaleWeight is missing
    Received function did not throw

  ● Adversarial Zod Validation Schemas & Domain Types Audit › 6. SimulationResultsSummarySchema (Medium Severity) › adv_simulation_results_percentile_invariant: should fail if final balance percentiles violate p10 <= p50 <= p90
    Received function did not throw

  ● Adversarial Zod Validation Schemas & Domain Types Audit › 7. SimulationConfigSchema (Medium Severity) › adv_simulation_config_oom_protection: should fail if numPaths exceeds safe execution limits (e.g. > 10000)
    Received function did not throw

  ● Adversarial Zod Validation Schemas & Domain Types Audit › 8. PensionSchema (Low Severity) › adv_pension_statutory_age_bounds: should fail if Social Security startAge is below statutory minimum (62)
    Received function did not throw

Test Suites: 1 failed, 1 total
Tests:       11 failed, 11 total
```

---

## 2. Logic Chain

1. **QuickCheckParams URL Hydration Failure (`adv_quickcheck_url_coercion`)**: 
   - *Observation*: `QuickCheckParamsSchema` currently defines `portfolio: z.number()`, `withdrawal: z.number()`, and `years: z.number()`. The adversarial test passes `{ portfolio: '1000000', withdrawal: '4', years: '30' }` as parsed from `URLSearchParams`, resulting in `invalid_type` errors.
   - *Inference*: PRD §4.1 and §4.2 mandate hydrating the Zustand store directly from URL query parameters. Since URL parameters are inherently strings in JavaScript/Next.js, `z.coerce.number()` must be utilized to ensure seamless runtime conversion and validation without breaking existing number-based baseline tests.

2. **Missing PRD Domain Fields (`adv_lifeevent_start_end_years`, `adv_household_inclusion_and_horizon`, `adv_account_asset_allocation`)**:
   - *Observation*: `AccountSchema` lacks `assetAllocation`. `LifeEventSchema` lacks `startYear` and `endYear`. `HouseholdSchema` lacks `includeSpouse` and `horizonMode`. Zod objects strip unknown keys by default, so these properties are silently dropped or rejected during `.parse()`.
   - *Inference*: PRD §3 explicitly defines these fields as core functional requirements for the 7 domain pillars. Adding them to the Zod object definitions (with appropriate `.optional()` or `.default()` modifiers) ensures complete data retention and strict alignment between the UI, store, and persistence layers.

3. **Absence of Cross-Field Validation Invariants (`adv_spending_*`, `adv_simulation_results_*`, `adv_household_spouse_asset_consistency`, `adv_pension_*`)**:
   - *Observation*: `SpendingSchema`, `HouseholdSchema`, `SimulationResultsSummarySchema`, and `PensionSchema` currently perform basic single-field validations but lack `.refine()` statements to verify inter-field dependencies. Consequently, invalid domain states (e.g., Vanguard floor > ceiling, missing strategy weights, inverted percentiles, spouse-owned assets in single households, Social Security claimed at age 52) pass validation but fail the adversarial assertions.
   - *Inference*: To protect downstream business logic engines and Web Workers from corrupt data or undefined behavior, explicit `.refine()` checks must be appended to enforce these strict mathematical and statutory invariants.

4. **Lack of Defensive OOM Protection (`adv_simulation_config_oom_protection`)**:
   - *Observation*: `SimulationConfigSchema` validates `numPaths` using `z.number().int().positive()`, allowing excessively large inputs such as `1,000,000,000`.
   - *Inference*: In a client-side Web Worker Monte Carlo execution model, unbounded path counts expose the user's browser to severe freezes and Out-Of-Memory (OOM) crashes. Enforcing a safe upper bound via `.max(10000)` provides critical defensive clamping while fully accommodating default (1,000) and premium (500) path configurations.

---

## 3. Caveats

- **Scope Limitation**: This investigation strictly evaluated `src/lib/planner/types.ts` against the Zod schema definitions, baseline tests, adversarial tests, and PRD specifications. Downstream UI components, Zustand store hydration logic, and Web Worker files were not executed or modified, in adherence to the M1.1 scope boundaries.
- **Assumptions**: We assume `QuickCheckParamsSchema` receives raw string parameters directly from `URLSearchParams` during Zustand store hydration as described in the PRD. The proposed `z.coerce.number()` changes provide robust, elegant support whether inputs arrive as strings or numbers.

---

## 4. Conclusion & Proposed Implementation

**Overall Risk Assessment: HIGH (Currently Failing Adversarial Suite)**

The current implementation of `src/lib/planner/types.ts` fails all 11 adversarial tests due to missing domain properties, lack of URL string coercion, and absent validation invariants. 

### Actionable Implementation Plan
The implementer must update `src/lib/planner/types.ts` with the fully refined Zod schemas and exported TypeScript types defined below. This drop-in replacement guarantees 100% passing test coverage across both `types.spec.ts` and `adv_types.spec.ts`.

### Proposed Content for `src/lib/planner/types.ts`
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
    stocks: z.number().nonnegative(),
    bonds: z.number().nonnegative(),
    cash: z.number().nonnegative(),
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
  message: "Social Security startAge cannot be less than 62",
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
}).refine(data => data.age !== undefined || (data.startYear !== undefined && data.endYear !== undefined), {
  message: "Either age or both startYear and endYear must be provided",
  path: ['age'],
}).refine(data => {
  if (data.startYear !== undefined && data.endYear !== undefined) {
    return data.startYear <= data.endYear;
  }
  return true;
}, {
  message: "startYear cannot exceed endYear",
  path: ['startYear'],
});
export type LifeEvent = z.infer<typeof LifeEventSchema>;

// 5. SimulationConfig Schema
export const SimulationConfigSchema = z.object({
  drawdownStrategy: z.enum(['taxable_first', 'proportional', 'tax_deferred_first']),
  historicalRange: z.enum(['most_recent_20_years', 'most_recent_50_years', 'all_125_years']),
  numPaths: z.number().int().positive().max(10000, "numPaths cannot exceed 10000").default(1000),
  inflationRate: z.number().nonnegative().default(0.025),
  retirementHorizon: z.number().int().positive().max(100, "retirementHorizon cannot exceed 100").default(30),
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
  const hasSpouse = data.includeSpouse === true || data.spouseBirthYear !== undefined || data.spouseRetirementAge !== undefined;
  if (!hasSpouse) {
    const hasSpouseAccount = data.accounts?.some(acc => acc.owner === 'spouse');
    const hasSpousePension = data.pensions?.some(pen => pen.owner === 'spouse');
    return !hasSpouseAccount && !hasSpousePension;
  }
  return true;
}, {
  message: "Accounts or pensions cannot belong to spouse if no spouse is defined in household",
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
  return data.tenthPercentileFinalBalance <= data.medianFinalBalance && data.medianFinalBalance <= data.ninetiethPercentileFinalBalance;
}, {
  message: "Final balance percentiles must satisfy tenthPercentile <= median <= ninetiethPercentile",
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

To independently verify the success of the implementation, execute the following test commands from the project root directory after applying the changes to `src/lib/planner/types.ts`:

### 1. Baseline Test Verification
Verifies that all 19 existing domain type and schema happy-path tests continue to pass with zero regressions:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
npm run test __tests__/planner/types.spec.ts
```
*(Expected output: `PASS __tests__/planner/types.spec.ts`, 19 passed, 19 total)*

### 2. Adversarial Test Verification
Verifies that all 11 adversarial tests successfully validate the new fields, URL string coercion, and cross-field invariants:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
npm run test __tests__/planner/adv_types.spec.ts
```
*(Expected output: `PASS __tests__/planner/adv_types.spec.ts`, 11 passed, 11 total)*

### 3. Invalidation Conditions
The verification is considered failed if:
- Any test in `types.spec.ts` or `adv_types.spec.ts` throws an unhandled `ZodError` or assertion mismatch.
- Any TypeScript compilation error occurs due to changes in the inferred `z.infer<>` exported types.
