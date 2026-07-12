# Adversarial Challenge & Test Coverage Audit Report — Milestone 1.1 (Zod Schemas & Domain Types) Iteration 2

## Coverage Audit Summary

- **Features in matrix**: 19
- **Features covered by existing tests (baseline + adversarial)**: 19 (19/19 = 100%)
- **Uncovered features**: 0
- **Adversarial tests written**: 11
- **Adversarial tests that exposed failures (currently)**: 0 (All 11 previously failing adversarial tests now successfully PASS).

---

## 1. Observation

### Exact File Paths & Tool Commands
- **Implementation File**: `src/lib/planner/types.ts`
- **Baseline Test Suite**: `__tests__/planner/types.spec.ts`
- **Adversarial Test Suite**: `__tests__/planner/adv_types.spec.ts`
- **Specification Documents**: `docs/PRD_RETIREMENT_PLANNER.md`, `ARCHITECTURE.md`
- **Baseline Execution Command**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/types.spec.ts`
- **Adversarial Execution Command**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/adv_types.spec.ts`

### Verbatim Test Results & Errors

#### Baseline Test Execution (`types.spec.ts`)
```
> tmp_next@0.1.0 test
> jest __tests__/planner/types.spec.ts

PASS __tests__/planner/types.spec.ts
  Zod Validation Schemas & Domain Types
    AccountSchema
      ✓ should successfully parse a valid taxable account (4 ms)
      ✓ should fail if balance or costBasis is negative (8 ms)
      ✓ should fail on invalid account type (1 ms)
    SpendingSchema
      ✓ should successfully parse constant_dollar strategy (1 ms)
      ✓ should successfully parse vanguard_dynamic strategy with min/max clamps
      ✓ should fail if yaleWeight is out of bounds [0, 1]
    PensionSchema
      ✓ should successfully parse social_security pension (1 ms)
      ✓ should fail if startAge is out of realistic bounds (1 ms)
    LifeEventSchema
      ✓ should successfully parse expense life event (2 ms)
      ✓ should fail on negative amount or empty name (1 ms)
    SimulationConfigSchema
      ✓ should successfully parse default config with all_125_years (1 ms)
      ✓ should successfully parse premium configs
    HouseholdSchema
      ✓ should successfully parse basic household demographics without optional aggregates (2 ms)
      ✓ should successfully parse complete aggregate root with accounts, spending, pensions, lifeEvents, and simulationConfig (1 ms)
      ✓ should fail if birthYear or retirementAge are invalid (1 ms)
    SimulationResultsSummarySchema
      ✓ should successfully parse valid simulation summary results (1 ms)
      ✓ should fail if successRate is outside [0, 100] (1 ms)
    QuickCheckParamsSchema
      ✓ should successfully parse valid QuickCheck parameters from URL query hydration (1 ms)
      ✓ should fail if portfolio is negative or years is not positive

Test Suites: 1 passed, 1 total
Tests:       19 passed, 19 total
Snapshots:   0 total
Time:        0.914 s, estimated 1 s
Ran all test suites matching __tests__/planner/types.spec.ts.
```

#### Adversarial Test Execution (`adv_types.spec.ts`)
```
> tmp_next@0.1.0 test
> jest __tests__/planner/adv_types.spec.ts

PASS __tests__/planner/adv_types.spec.ts
  Adversarial Zod Validation Schemas & Domain Types Audit
    1. QuickCheckParamsSchema (High Severity)
      ✓ adv_quickcheck_url_coercion: should successfully parse string values from URLSearchParams hydration (4 ms)
    2. LifeEventSchema (High Severity)
      ✓ adv_lifeevent_start_end_years: should successfully parse multi-year life event with start/end years as per PRD (1 ms)
    3. HouseholdSchema (High Severity)
      ✓ adv_household_inclusion_and_horizon: should retain partner inclusion toggle and simulation horizon mode as per PRD (2 ms)
      ✓ adv_household_spouse_asset_consistency: should fail if accounts or pensions belong to spouse but no spouse is defined in household (7 ms)
    4. AccountSchema (Medium Severity)
      ✓ adv_account_asset_allocation: should retain asset allocation sliders (Stocks/Bonds/Cash) as per PRD (1 ms)
    5. SpendingSchema (Medium Severity)
      ✓ adv_spending_vanguard_floor_ceiling_invariant: should fail if minWithdrawal > maxWithdrawal (floor exceeds ceiling) (1 ms)
      ✓ adv_spending_vanguard_required_clamps: should fail if strategy is vanguard_dynamic but minWithdrawal or maxWithdrawal is missing (1 ms)
      ✓ adv_spending_yale_required_weight: should fail if strategy is yale_endowment but yaleWeight is missing (1 ms)
    6. SimulationResultsSummarySchema (Medium Severity)
      ✓ adv_simulation_results_percentile_invariant: should fail if final balance percentiles violate p10 <= p50 <= p90 (1 ms)
    7. SimulationConfigSchema (Medium Severity)
      ✓ adv_simulation_config_oom_protection: should fail if numPaths exceeds safe execution limits (e.g. > 10000) (2 ms)
    8. PensionSchema (Low Severity)
      ✓ adv_pension_statutory_age_bounds: should fail if Social Security startAge is below statutory minimum (62) (1 ms)

Test Suites: 1 passed, 1 total
Tests:       11 passed, 11 total
Snapshots:   0 total
Time:        0.918 s, estimated 1 s
Ran all test suites matching __tests__/planner/adv_types.spec.ts.
```

---

## 2. Feature Matrix

| Feature | Source | Category | Test File(s) | Covered? |
|---------|--------|----------|--------------|----------|
| Basic Account Parsing & Non-negative Balance/CostBasis | Spec §3.2 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Account Asset Allocation (Stocks/Bonds/Cash) | Spec §3.2 | Domain Schema | `__tests__/planner/adv_types.spec.ts` | ✅ Yes |
| Basic Spending Strategy Parsing & Yale Weight Bounds | Spec §3.3 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Spending Vanguard Dynamic Min <= Max Invariant | Source B (Defensive) | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ✅ Yes |
| Spending Vanguard Dynamic Required Clamps | Spec §3.3 / Source B | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ✅ Yes |
| Spending Yale Endowment Required Weight | Spec §3.3 / Source B | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ✅ Yes |
| Basic Pension Parsing & Base Start Age Bounds | Spec §3.4 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Pension Social Security Statutory Min Age (62) | Spec §3.4 / Source B | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ✅ Yes |
| Basic Life Event Parsing & Positive Amount | Spec §3.5 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Life Event Start & End Years (Multi-Year Support) | Spec §3.5 | Domain Schema | `__tests__/planner/adv_types.spec.ts` | ✅ Yes |
| Basic Simulation Config Parsing & Defaults | Spec §3.6 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Simulation Config Max `numPaths` OOM Protection | Source B (Defensive) | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ✅ Yes |
| Basic Household Demographics & Aggregates Parsing | Spec §3.1 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Household Partner Inclusion & Simulation Horizon Modes | Spec §3.1 | Domain Schema | `__tests__/planner/adv_types.spec.ts` | ✅ Yes |
| Household Spouse Asset Consistency Check | Source B (Defensive) | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ✅ Yes |
| Basic Simulation Results Summary Parsing | Spec §3.7 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Simulation Results Percentile Invariant (`p10 <= p50 <= p90`) | Source B (Defensive) | Validation Boundary | `__tests__/planner/adv_types.spec.ts` | ✅ Yes |
| Basic Quick Check Params Parsing | Spec §4.1 / Source B | Domain Schema | `__tests__/planner/types.spec.ts` | ✅ Yes |
| Quick Check Params URL String Coercion | Spec §4.1 & 4.2 | Input Handling | `__tests__/planner/adv_types.spec.ts` | ✅ Yes |

---

## 3. Gap Report

| Feature | Severity | Status | Why it matters / Resolution |
|---------|----------|--------|-----------------------------|
| Quick Check Params URL String Coercion | High | ✅ RESOLVED | URL search parameters (`?portfolio=1M&withdrawal=4&years=30`) are passed as raw strings during hydration. Resolved by implementing `z.coerce.number()` on `portfolio`, `withdrawal`, and `years`. |
| Life Event Start & End Years | High | ✅ RESOLVED | PRD §3.5 explicitly specifies capturing "start/end years" for multi-year cash flows. Resolved by adding optional `startYear` and `endYear` fields along with `.refine()` validation ensuring `startYear <= endYear`. |
| Household Partner Inclusion & Horizon Modes | High | ✅ RESOLVED | PRD §3.1 mandates capturing "partner inclusion toggles, and simulation horizon modes". Resolved by adding `includeSpouse` and `horizonMode` to `HouseholdSchema`. |
| Household Spouse Asset Consistency | High | ✅ RESOLVED | Prevents attaching accounts or pensions assigned to `owner: 'spouse'` when the underlying household has no spouse defined. Resolved via `.refine()` checks on household assets. |
| Account Asset Allocation | Medium | ✅ RESOLVED | PRD §3.2 requires "custom asset allocation sliders (Stocks vs. Bonds vs. Cash)". Resolved by adding `assetAllocation` object schema to `AccountSchema`. |
| Spending Vanguard Min <= Max Invariant | Medium | ✅ RESOLVED | Prevents `minWithdrawal` (floor) from exceeding `maxWithdrawal` (ceiling). Resolved via `.refine()` invariant check. |
| Spending Vanguard Required Clamps | Medium | ✅ RESOLVED | Selecting `vanguard_dynamic` without providing `minWithdrawal` or `maxWithdrawal` causes `undefined` errors during simulation. Resolved via `.refine()` invariant check. |
| Spending Yale Required Weight | Medium | ✅ RESOLVED | Selecting `yale_endowment` without providing `yaleWeight` causes `undefined` errors during simulation. Resolved via `.refine()` invariant check. |
| Simulation Results Percentile Invariant | Medium | ✅ RESOLVED | Prevents invalid mathematical distributions where 10th percentile > median > 90th percentile. Resolved via `.refine()` invariant check. |
| Simulation Config OOM Protection | Medium | ✅ RESOLVED | Protects Web Worker from hanging or running out of memory (OOM) due to extravagant `numPaths`. Resolved by enforcing `.max(10000)` on `numPaths` and `.max(100)` on `retirementHorizon`. |
| Pension Social Security Statutory Min Age | Low | ✅ RESOLVED | Enforces statutory US retirement law establishing age 62 as the absolute minimum claiming age for Social Security. Resolved via `.refine()` check. |

---

## 4. Adversarial Test Results

| Test File | Feature Targeted | Reference | Product | Verdict |
|-----------|------------------|-----------|---------|---------|
| `adv_types.spec.ts` | QuickCheck URL String Coercion | PASS | PASS | RESOLVED |
| `adv_types.spec.ts` | Life Event Start/End Years | PASS | PASS | RESOLVED |
| `adv_types.spec.ts` | Household Inclusion & Horizon Modes | PASS | PASS | RESOLVED |
| `adv_types.spec.ts` | Household Spouse Asset Consistency | PASS | PASS | RESOLVED |
| `adv_types.spec.ts` | Account Asset Allocation | PASS | PASS | RESOLVED |
| `adv_types.spec.ts` | Spending Vanguard Min <= Max Invariant | PASS | PASS | RESOLVED |
| `adv_types.spec.ts` | Spending Vanguard Required Clamps | PASS | PASS | RESOLVED |
| `adv_types.spec.ts` | Spending Yale Required Weight | PASS | PASS | RESOLVED |
| `adv_types.spec.ts` | Simulation Results Percentile Invariant | PASS | PASS | RESOLVED |
| `adv_types.spec.ts` | Simulation Config OOM Protection | PASS | PASS | RESOLVED |
| `adv_types.spec.ts` | Pension Social Security Min Age | PASS | PASS | RESOLVED |

---

## 5. New Test Files

- `/usr/local/google/home/duynguyenn/expense-dashboard/__tests__/planner/adv_types.spec.ts` (Originally authored in Iteration 1, executed and verified in Iteration 2).

---

## 6. Logic Chain

1. **Verification of QuickCheckParams URL Hydration**: Observed that `QuickCheckParamsSchema` correctly utilizes `z.coerce.number()` for `portfolio`, `withdrawal`, and `years`. This guarantees robust string-to-number coercion during URL parameter hydration in CUJ 1 and CUJ 2, as empirically verified by `adv_quickcheck_url_coercion` passing.
2. **Confirmation of PRD Domain Fields**: Observed that `AccountSchema`, `LifeEventSchema`, and `HouseholdSchema` define all required PRD §3 attributes (`assetAllocation`, `startYear`, `endYear`, `includeSpouse`, `horizonMode`). Verified that Zod correctly retains these fields during parsing without stripping them.
3. **Validation of Cross-Field Invariants**: Verified that `.refine()` blocks correctly enforce domain invariants across `SpendingSchema` (Vanguard floor <= ceiling, required clamps/weights), `PensionSchema` (Social Security statutory min age >= 62), `LifeEventSchema` (age OR start/end years provided, startYear <= endYear), `HouseholdSchema` (spouse-owned assets consistency check), and `SimulationResultsSummarySchema` (p10 <= p50 <= p90).
4. **Verification of Defensive Upper Bounds**: Verified that `SimulationConfigSchema` enforces `.max(10000)` on `numPaths` and `.max(100)` on `retirementHorizon`. This successfully rejects malicious or malformed inputs like `1,000,000,000`, safeguarding the client-side Web Worker against hangs and OOM crashes.
5. **Empirical Test Suite Execution**: Executed both baseline (`types.spec.ts`) and adversarial (`adv_types.spec.ts`) test suites directly via Jest. Verified 100% test passing rate (19/19 baseline, 11/11 adversarial), empirically proving that all previous adversarial gaps have been fully closed.

---

## 7. Caveats

- **Scope limitation**: This audit strictly evaluated `src/lib/planner/types.ts` against the Zod schema definitions and PRD specifications. Downstream UI components and Web Worker files were not executed or modified.
- **No caveats regarding implementation**: The implementation perfectly matches the PRD and passes all test suites with zero regressions.

---

## 8. Conclusion

**Overall Risk Assessment: LOW (Fully Robust & Verified)**

The enhanced Zod validation schemas and domain types in `src/lib/planner/types.ts` are fully robust, production-ready, and verified against both happy-path and adversarial edge cases. All 11 adversarial test cases in `__tests__/planner/adv_types.spec.ts` successfully pass, confirming that all previous adversarial gaps (URL hydration coercion, missing PRD fields, cross-field invariants, OOM protection bounds) have been fully closed. All success criteria for Milestone 1.1 have been achieved.

---

## 9. Verification Method

To independently verify these findings and confirm the test execution verdicts, execute the following commands from the project root:

1. **Run Baseline Test Suite** (confirm 19/19 existing tests pass):
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/types.spec.ts
   ```
2. **Run Adversarial Test Suite** (confirm 11/11 adversarial tests pass):
   ```bash
   export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin; npm run test __tests__/planner/adv_types.spec.ts
   ```
