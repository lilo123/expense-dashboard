# Adversarial Challenge & Test Coverage Audit Report — Milestone 1.1 (Zod Schemas & Domain Types)

## Coverage Audit Summary

- **Features in matrix**: 19
- **Features covered by existing tests**: 8 (8/19 = 42.1%)
- **Uncovered features**: 11
- **Adversarial tests written**: 11
- **Adversarial tests that exposed failures**: 11

---

## 1. Observation

### Exact File Paths & Tool Commands
- **Implementation File**: `src/lib/planner/types.ts`
- **Existing Test Suite**: `__tests__/planner/types.spec.ts`
- **Specification Documents**: `docs/PRD_RETIREMENT_PLANNER.md`, `ARCHITECTURE.md`
- **Adversarial Test Suite**: `__tests__/planner/adv_types.spec.ts`
- **Baseline Execution Command**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/types.spec.ts`
- **Adversarial Execution Command**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/adv_types.spec.ts -- --verbose`

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

## 2. Feature Matrix

| Feature | Source | Category | Test File(s) | Covered? |
|---------|--------|----------|--------------|----------|
| Basic Account Parsing & Non-negative Balance/CostBasis | Spec §3.2 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Account Asset Allocation (Stocks/Bonds/Cash) | Spec §3.2 | Domain Schema | `__tests__/planner/adv_types.spec.ts` | ❌ No |
| Basic Spending Strategy Parsing & Yale Weight Bounds | Spec §3.3 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Spending Vanguard Dynamic Min <= Max Invariant | Source B (Defensive) | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ❌ No |
| Spending Vanguard Dynamic Required Clamps | Spec §3.3 / Source B | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ❌ No |
| Spending Yale Endowment Required Weight | Spec §3.3 / Source B | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ❌ No |
| Basic Pension Parsing & Base Start Age Bounds | Spec §3.4 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Pension Social Security Statutory Min Age (62) | Spec §3.4 / Source B | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ❌ No |
| Basic Life Event Parsing & Positive Amount | Spec §3.5 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Life Event Start & End Years (Multi-Year Support) | Spec §3.5 | Domain Schema | `__tests__/planner/adv_types.spec.ts` | ❌ No |
| Basic Simulation Config Parsing & Defaults | Spec §3.6 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Simulation Config Max `numPaths` OOM Protection | Source B (Defensive) | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ❌ No |
| Basic Household Demographics & Aggregates Parsing | Spec §3.1 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Household Partner Inclusion & Simulation Horizon Modes | Spec §3.1 | Domain Schema | `__tests__/planner/adv_types.spec.ts` | ❌ No |
| Household Spouse Asset Consistency Check | Source B (Defensive) | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ❌ No |
| Basic Simulation Results Summary Parsing | Spec §3.7 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Simulation Results Percentile Invariant (`p10 <= p50 <= p90`) | Source B (Defensive) | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ❌ No |
| Basic Quick Check Params Parsing | Spec §4.1 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Quick Check Params URL String Coercion | Spec §4.1 & 4.2 | Input Handling | `__tests__/planner/adv_types.spec.ts` | ❌ No |

---

## 3. Gap Report

| Feature | Severity | Why it matters |
|---------|----------|----------------|
| Quick Check Params URL String Coercion | High | URL search parameters (`?portfolio=1M&withdrawal=4&years=30`) are passed as raw strings during hydration in `useRetirementStore.tsx`. Without `z.coerce.number()`, Zod throws an `invalid_type` error, breaking CUJ 1 & CUJ 2 handoff. |
| Life Event Start & End Years | High | PRD §3.5 explicitly specifies capturing "start/end years" for multi-year cash flows (e.g., 4 years of college tuition). `LifeEventSchema` currently only captures a single `age: z.number()`, preventing multi-year modeling. |
| Household Partner Inclusion & Horizon Modes | High | PRD §3.1 mandates capturing "partner inclusion toggles, and simulation horizon modes (Fixed Years vs. actuarial Life Expectancy)". `HouseholdSchema` completely lacks these fields, resulting in silent data stripping. |
| Household Spouse Asset Consistency | High | Users can attach accounts or pensions assigned to `owner: 'spouse'` even when the underlying household has no spouse defined, causing undefined behavior during tax and drawdown simulations. |
| Account Asset Allocation | Medium | PRD §3.2 requires "custom asset allocation sliders (Stocks vs. Bonds vs. Cash)". `AccountSchema` lacks `assetAllocation`, stripping user asset preferences during Zod parsing. |
| Spending Vanguard Min <= Max Invariant | Medium | `minWithdrawal` (floor) can be set higher than `maxWithdrawal` (ceiling), which breaks the Vanguard dynamic withdrawal mathematical clamp logic in the Web Worker. |
| Spending Vanguard Required Clamps | Medium | Selecting `vanguard_dynamic` without providing `minWithdrawal` or `maxWithdrawal` passes validation but causes `undefined` errors during simulation. |
| Spending Yale Required Weight | Medium | Selecting `yale_endowment` without providing `yaleWeight` passes validation but causes `undefined` errors during simulation. |
| Simulation Results Percentile Invariant | Medium | `SimulationResultsSummarySchema` accepts invalid mathematical distributions where 10th percentile > median > 90th percentile, risking data corruption in Supabase persistence. |
| Simulation Config OOM Protection | Medium | `numPaths` lacks an upper bound (`z.number().int().positive()`). An attacker or malformed input can pass `1,000,000,000`, causing the Web Worker to hang or run out of memory (OOM). |
| Pension Social Security Statutory Min Age | Low | Social Security claiming age is allowed down to age 50 in `PensionSchema`, whereas statutory US retirement law establishes age 62 as the absolute minimum claiming age. |

---

## 4. Adversarial Test Results

| Test File | Feature Targeted | Reference | Product | Verdict |
|-----------|------------------|-----------|---------|---------|
| `adv_types.spec.ts` | QuickCheck URL String Coercion | PASS | FAIL | BUG |
| `adv_types.spec.ts` | Life Event Start/End Years | PASS | FAIL | BUG |
| `adv_types.spec.ts` | Household Inclusion & Horizon Modes | PASS | FAIL | BUG |
| `adv_types.spec.ts` | Household Spouse Asset Consistency | PASS | FAIL | BUG |
| `adv_types.spec.ts` | Account Asset Allocation | PASS | FAIL | BUG |
| `adv_types.spec.ts` | Spending Vanguard Min <= Max Invariant | PASS | FAIL | BUG |
| `adv_types.spec.ts` | Spending Vanguard Required Clamps | PASS | FAIL | BUG |
| `adv_types.spec.ts` | Spending Yale Required Weight | PASS | FAIL | BUG |
| `adv_types.spec.ts` | Simulation Results Percentile Invariant | PASS | FAIL | BUG |
| `adv_types.spec.ts` | Simulation Config OOM Protection | PASS | FAIL | BUG |
| `adv_types.spec.ts` | Pension Social Security Min Age | PASS | FAIL | BUG |

---

## 5. New Test Files

- `/usr/local/google/home/duynguyenn/expense-dashboard/__tests__/planner/adv_types.spec.ts`

---

## 6. Logic Chain

1. **QuickCheckParams URL Hydration Failure**: In `adv_types.spec.ts`, passing `{ portfolio: '1000000', withdrawal: '4', years: '30' }` directly throws a ZodError (`expected number, received string`). Since `QuickCheckParamsSchema` is explicitly designated in PRD §4.1 and §4.2 to hydrate state from URL search parameters (which are natively strings), `z.coerce.number()` must be used instead of `z.number()`.
2. **Missing PRD Domain Fields**: `AccountSchema`, `LifeEventSchema`, and `HouseholdSchema` were empirically shown to drop or reject properties explicitly mandated by PRD §3 (e.g., `assetAllocation`, `startYear`, `endYear`, `includeSpouse`, `horizonMode`). Because Zod objects strip unknown keys by default, these missing fields create a severe functional gap between the UI/PRD requirements and the persistence layer.
3. **Absence of Cross-Field Invariants & Discriminated Unions**: `SpendingSchema`, `HouseholdSchema`, and `SimulationResultsSummarySchema` do not implement `.refine()` or `z.discriminatedUnion()`. As observed in the test failures, this allows invalid states (e.g., Vanguard floor > ceiling, spouse accounts in single households, inverted percentiles) to pass validation and corrupt downstream Web Worker Monte Carlo simulations.
4. **Lack of Defensive Upper Bounds**: `SimulationConfigSchema` validates `numPaths` using `z.number().int().positive()`, successfully accepting `1,000,000,000`. In a client-side Web Worker execution model (as described in `ARCHITECTURE.md`), this unbounded parameter exposes the browser to severe freeze/OOM vulnerabilities.

---

## 7. Caveats

- **Scope limitation**: This audit strictly evaluated `src/lib/planner/types.ts` against the Zod schema definitions and PRD specifications. Downstream UI components and Web Worker files were not executed or modified.
- **Assumptions**: We assume that `QuickCheckParamsSchema` receives raw string parameters directly from `URLSearchParams` during Zustand store hydration as described in the PRD. If an intermediate parsing layer exists, `z.coerce` provides robust defensive redundancy regardless.

---

## 8. Conclusion

**Overall Risk Assessment: HIGH**

The existing Zod schemas in `src/lib/planner/types.ts` provide basic type safety but exhibit critical gaps in PRD specification alignment, URL parameter hydration, cross-field validation invariants, and defensive boundary clamping. The 11 adversarial tests in `__tests__/planner/adv_types.spec.ts` empirically prove these vulnerabilities by failing across all 11 test cases. 

To achieve production-grade robustness and complete PRD compliance, `src/lib/planner/types.ts` must be updated to incorporate `z.coerce.number()` for URL hydration, add the missing PRD fields (`assetAllocation`, `startYear`, `endYear`, `includeSpouse`, `horizonMode`), implement `z.discriminatedUnion()`/`.refine()` for strategy invariants, and enforce safe upper bounds on simulation parameters.

---

## 9. Verification Method

To independently verify these findings and confirm the test execution verdicts, execute the following commands from the project root:

1. **Run Baseline Test Suite** (confirm existing tests pass):
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/types.spec.ts
   ```
2. **Run Adversarial Test Suite** (confirm 11 validation gaps and failures):
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/adv_types.spec.ts -- --verbose
   ```
3. **Inspect Adversarial Test Source**:
   ```bash
   cat __tests__/planner/adv_types.spec.ts
   ```
