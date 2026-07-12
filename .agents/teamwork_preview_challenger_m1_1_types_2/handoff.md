# Adversarial Challenge Report: Milestone 1.1 (Zod Schemas & Domain Types)

## Coverage Audit Summary

- Features in matrix: 19
- Features covered by existing tests: 10 (10/19 = 52.6%)
- Uncovered features / Validation Gaps: 9
- Adversarial tests written: 11
- Adversarial tests that exposed failures: 11

---

## 1. Observation

### Existing Test Suite Baseline
- Executed command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/types.spec.ts`
- Result: `PASS __tests__/planner/types.spec.ts` (19 passed, 19 total, 0.918s).
- Direct observation: The existing test suite verifies happy paths and basic boundary rejections (e.g., negative balances, unknown account types, success rate > 100), confirming baseline correctness of the current implementation in `src/lib/planner/types.ts`.

### Whitebox Inspection of `src/lib/planner/types.ts` vs Specifications
- Inspecting `docs/PRD_RETIREMENT_PLANNER.md` and `ARCHITECTURE.md` revealed 9 concrete gaps between the required domain models and the Zod schemas in `src/lib/planner/types.ts`:
  1. `QuickCheckParamsSchema` (`types.ts:96-102`): Uses strict `z.number()` for `portfolio`, `withdrawal`, `years`. `ARCHITECTURE.md` §7.A specifies URL hydration via query parameters (`?portfolio=1000000&withdrawal=4&years=30`). Since URLSearchParams returns strings, `QuickCheckParamsSchema.parse` throws `invalid_type` (expected number, received string) at runtime.
  2. `LifeEventSchema` (`types.ts:38-46`): Contains only a single `age` field. `PRD_RETIREMENT_PLANNER.md` §3.5 explicitly mandates managing events "with start/end years" (e.g., 4-year college tuition).
  3. `HouseholdSchema` (`types.ts:60-76`): Omits `includeSpouse` (partner inclusion toggle) and `horizonMode` (simulation horizon modes: Fixed Years vs Life Expectancy) mandated by `PRD_RETIREMENT_PLANNER.md` §3.1.
  4. `AccountSchema` (`types.ts:4-12`): Omits `assetAllocation` sliders (Stocks vs. Bonds vs. Cash) mandated by `PRD_RETIREMENT_PLANNER.md` §3.2.
  5. `SpendingSchema` (`types.ts:16-24`): Fails to enforce `minWithdrawal <= maxWithdrawal` (allowing floor > ceiling) and allows omitting required clamp/weight parameters for `vanguard_dynamic` and `yale_endowment`.
  6. `SimulationResultsSummarySchema` (`types.ts:79-93`): Fails to enforce the mathematical invariant `tenthPercentileFinalBalance <= medianFinalBalance <= ninetiethPercentileFinalBalance`.
  7. `SimulationConfigSchema` (`types.ts:49-57`): Lacks upper bounds on `numPaths` and `retirementHorizon`, leaving the Web Worker vulnerable to Out-Of-Memory (OOM) crashes if `numPaths: 1000000000` is passed.
  8. `PensionSchema` (`types.ts:27-35`): Allows `startAge` down to 50 for `social_security`, violating statutory earliest claim age (62).
  9. `HouseholdSchema` (`types.ts:60-76`): Lacks cross-field validation to reject spouse-owned accounts/pensions when no spouse exists in the household demographics.

### Adversarial Test Suite Execution
- Executed command: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/adv_types.spec.ts`
- Result: `Test Suites: 1 failed, 1 total. Tests: 11 failed, 11 total.`
- Verbatim errors observed:
  - `adv_quickcheck_url_coercion`: `Invalid input: expected number, received string`
  - `adv_lifeevent_start_end_years`: `Invalid input: expected number, received undefined` at `age`
  - `adv_household_inclusion_and_horizon`: `Expected path: "includeSpouse" Received path: []`
  - `adv_account_asset_allocation`: `Expected path: "assetAllocation" Received path: []`
  - `adv_spending_vanguard_floor_ceiling_invariant`: `Received function did not throw`
  - `adv_simulation_config_oom_protection`: `Received function did not throw`

---

## 2. Logic Chain

1. **URL Hydration Failure**: In Next.js / React SPAs, URL query parameters parsed via `new URLSearchParams(window.location.search)` are typed as strings. Because `QuickCheckParamsSchema` uses `z.number()` instead of `z.coerce.number()`, passing raw URL parameters to `QuickCheckParamsSchema.parse` during CUJ 2 hydration will inevitably throw a `ZodError`, breaking the onboarding flow.
2. **Domain Specification Discrepancies**: The PRD defines strict structural requirements for `LifeEvents` (start/end years), `Household` (partner inclusion, horizon modes), and `Accounts` (asset allocation sliders). Because Zod schemas define the runtime validation boundaries and TypeScript types (`z.infer`), omitting these fields prevents the UI from persisting or hydrating these required features.
3. **Missing Invariant & OOM Defenses**: Zod's primary role in a defense-in-depth architecture is to protect backend server actions and Web Workers from malicious or malformed inputs. By omitting `.refine()` invariants (`floor <= ceiling`, `p10 <= p50 <= p90`, spouse asset consistency) and upper bounds (`numPaths <= 10000`), the application is exposed to inconsistent state bugs, negative clamp deltas, and Web Worker OOM crashes.

---

## 3. Caveats

- **Scope Limitation**: The examination was strictly limited to Zod schemas and domain types (`src/lib/planner/types.ts`). Downstream consumers (e.g., Zustand stores, Web Workers, Supabase server actions) were not evaluated for runtime behavior as they are scheduled for subsequent milestones.
- **Assumptions**: We assume `QuickCheckParamsSchema` is intended to be used directly on raw URL query objects as implied by `ARCHITECTURE.md`. If a separate manual parsing layer was planned, `z.coerce.number()` would still be recommended as best practice to eliminate redundant boilerplate.

---

## 4. Conclusion

The baseline implementation in `src/lib/planner/types.ts` correctly establishes basic type definitions and passes its existing test suite (`__tests__/planner/types.spec.ts`). However, our adversarial audit uncovered 9 significant validation gaps, missing fields, and unhandled bounds when measured against `PRD_RETIREMENT_PLANNER.md` and `ARCHITECTURE.md`.

### Recommended Actionable Fixes for `src/lib/planner/types.ts`:
1. **QuickCheckParamsSchema**: Update `z.number()` to `z.coerce.number()` for `portfolio`, `withdrawal`, `years`.
2. **LifeEventSchema**: Add `startYear: z.number().int().positive()` and `endYear: z.number().int().positive()`, and make `age` optional or replace it.
3. **HouseholdSchema**: Add `includeSpouse: z.boolean().default(false)` and `horizonMode: z.enum(['fixed_years', 'life_expectancy']).default('fixed_years')`. Add a `.refine()` check to ensure spouse-owned accounts/pensions are not present if `includeSpouse` is false.
4. **AccountSchema**: Add `assetAllocation: z.object({ stocks: z.number(), bonds: z.number(), cash: z.number() }).optional()`.
5. **SpendingSchema**: Add `.refine(data => !data.minWithdrawal || !data.maxWithdrawal || data.minWithdrawal <= data.maxWithdrawal, { message: "Minimum withdrawal floor cannot exceed ceiling" })`. Add refinements to enforce required fields for `vanguard_dynamic` and `yale_endowment`.
6. **SimulationConfigSchema**: Add `.max(10000)` to `numPaths` and `.max(100)` to `retirementHorizon`.
7. **SimulationResultsSummarySchema**: Add `.refine(data => data.tenthPercentileFinalBalance <= data.medianFinalBalance && data.medianFinalBalance <= data.ninetiethPercentileFinalBalance)`.
8. **PensionSchema**: Add `.refine(data => !(data.type === 'social_security' && data.startAge < 62), { message: "Social Security cannot be claimed before age 62" })`.

---

## 5. Verification Method

### Baseline Verification
To verify that the existing happy-path test suite passes:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
npm run test __tests__/planner/types.spec.ts
```
*(Expected output: 19 passed, 19 total)*

### Adversarial Verification (Gap Invalidation Condition)
To verify the gaps and confirm when they have been successfully resolved by the implementer:
```bash
export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin
npm run test __tests__/planner/adv_types.spec.ts
```
*(Current output: 11 failed. When fixes are applied to `types.ts`, all 11 tests will PASS).*

---

## Feature Matrix

| Feature | Source | Category | Test File(s) | Covered? |
|---------|--------|----------|--------------|----------|
| Basic account fields & non-negative constraints | Spec §3.2 / Types.ts | Account | `types.spec.ts` | ✅ Yes |
| Account asset allocation sliders | Spec §3.2 | Account | `adv_types.spec.ts` | ❌ No |
| Basic spending fields & strategy enums | Spec §3.3 / Types.ts | Spending | `types.spec.ts` | ✅ Yes |
| Vanguard dynamic floor/ceiling clamp validation | Spec §3.3 | Spending | `adv_types.spec.ts` | ❌ No |
| Yale endowment required weight validation | Spec §3.3 | Spending | `adv_types.spec.ts` | ❌ No |
| Basic pension fields & claim age 50-80 bounds | Spec §3.4 / Types.ts | Pension | `types.spec.ts` | ✅ Yes |
| Pension statutory age bounds (`social_security` >= 62) | Spec §3.4 | Pension | `adv_types.spec.ts` | ❌ No |
| Basic life event fields & positive amount | Spec §3.5 / Types.ts | Life Event | `types.spec.ts` | ✅ Yes |
| Life event start/end years range | Spec §3.5 | Life Event | `adv_types.spec.ts` | ❌ No |
| Simulation config basic fields & defaults | Spec §3.6 / Types.ts | Simulation | `types.spec.ts` | ✅ Yes |
| Simulation config upper bounds (OOM protection) | Spec §3.6 | Simulation | `adv_types.spec.ts` | ❌ No |
| Household basic & spouse demographics & aggregates | Spec §3.1 / Types.ts | Household | `types.spec.ts` | ✅ Yes |
| Household partner inclusion toggle & horizon mode | Spec §3.1 | Household | `adv_types.spec.ts` | ❌ No |
| Household cross-field spouse asset consistency | Spec §3.1 | Household | `adv_types.spec.ts` | ❌ No |
| Simulation results summary basic fields & success rate | Spec §3.7 / Types.ts | Results | `types.spec.ts` | ✅ Yes |
| Simulation results summary logical invariant (`p10 <= p50 <= p90`) | Spec §3.7 | Results | `adv_types.spec.ts` | ❌ No |
| QuickCheckParams basic number parsing | Spec §4.1 / Types.ts | Quick Check | `types.spec.ts` | ✅ Yes |
| QuickCheckParams URL search param string coercion | Spec §4.1 / Arch §7.A | Quick Check | `adv_types.spec.ts` | ❌ No |

---

## Gap Report

| Feature | Severity | Why it matters |
|---------|----------|----------------|
| QuickCheckParams URL Search Param String Coercion | High | URL query parameters are strings; lacking `z.coerce.number()` causes runtime throws during CUJ 2 hydration. |
| LifeEvent Start/End Years Range | High | PRD §3.5 mandates multi-year event ranges (e.g., college tuition); `types.ts` only has a single `age` field. |
| Household Partner Inclusion Toggle & Horizon Mode | High | PRD §3.1 mandates capturing partner inclusion toggles and simulation horizon modes; both are missing from `HouseholdSchema`. |
| Account Asset Allocation Sliders | Medium | PRD §3.2 mandates Stocks/Bonds/Cash asset allocation sliders; missing from `AccountSchema`. |
| Spending Strategy Conditional Requirements & Clamps | Medium | `vanguard_dynamic` lacks `minWithdrawal <= maxWithdrawal` checks; `yale_endowment` allows omitting required weights. |
| SimulationResultsSummary Percentile Invariants | Medium | Lacks `.refine()` to ensure `tenthPercentileFinalBalance <= medianFinalBalance <= ninetiethPercentileFinalBalance`. |
| SimulationConfig Upper Bounds (OOM Protection) | Medium | `numPaths` lacks `.max()`, allowing inputs like `1,000,000,000` that cause Web Worker OOM crashes or hangs. |
| Pension Statutory Age Bounds | Low | Allows claiming Social Security at age 50, below statutory earliest claim age of 62. |
| Household Cross-Field Spouse Asset Consistency | Low | Allows spouse-owned accounts/pensions to validate successfully even when no spouse. |

---

## Adversarial Test Results

| Test File | Feature Targeted | Reference / Spec | Product | Verdict |
|-----------|------------------|------------------|---------|---------|
| `adv_types.spec.ts` | QuickCheck URL string coercion | PASS | FAIL | BUG / GAP |
| `adv_types.spec.ts` | LifeEvent start/end years | PASS | FAIL | BUG / GAP |
| `adv_types.spec.ts` | Household inclusion & horizon mode | PASS | FAIL | BUG / GAP |
| `adv_types.spec.ts` | Household spouse asset consistency | PASS | FAIL | BUG / GAP |
| `adv_types.spec.ts` | Account asset allocation sliders | PASS | FAIL | BUG / GAP |
| `adv_types.spec.ts` | Spending vanguard clamp invariant | PASS | FAIL | BUG / GAP |
| `adv_types.spec.ts` | Spending vanguard required clamps | PASS | FAIL | BUG / GAP |
| `adv_types.spec.ts` | Spending yale required weight | PASS | FAIL | BUG / GAP |
| `adv_types.spec.ts` | Simulation results percentile invariant | PASS | FAIL | BUG / GAP |
| `adv_types.spec.ts` | Simulation config OOM protection | PASS | FAIL | BUG / GAP |
| `adv_types.spec.ts` | Pension statutory age bounds | PASS | FAIL | BUG / GAP |

---

## New Test Files

- `/usr/local/google/home/duynguyenn/expense-dashboard/__tests__/planner/adv_types.spec.ts`
