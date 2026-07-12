# Milestone 3.2 Review & Handoff Report: Server Actions (BOLA & Premium Defenses)

## 1. Observation

### File Inspections
- **`src/app/actions/retirementActions.ts`**:
  - Lines 7-26 (`getUserAndTier`): Fetches the authenticated user securely via `supabase.auth.getUser()`. Properly queries `profiles` for the user's tier, handles `PGRST116` (row not found) gracefully, and defaults to `'free'`.
  - Lines 28-53 (`getPlans`): Implements strict BOLA defense on line 37 (`.eq('user_id', user.id)`). Catches errors and enforces explicit error contracts (`Unauthorized` or `Failed to fetch retirement plans.`).
  - Lines 55-82 (`getPlan`): Validates input `if (!id) return { success: false, error: 'Invalid plan ID' };` on line 58. Implements explicit BOLA filtering on lines 65-66 (`.eq('id', id).eq('user_id', user.id)`). Mismatched error contracts and mock return facades (e.g., `if (id.length !== 36)` or `if (id.includes('malicious'))`) are confirmed to be entirely absent.
  - Lines 84-174 (`savePlan`):
    - Lines 89-96: Validates `id` format if present in `planData` without mutating the incoming object (confirmed complete absence of `delete dataObj.id`).
    - Lines 99-106: Validates incoming data using Zod via `HouseholdSchema.safeParse(planData)` on line 99. Safely destructures `id` and `user_id` out of `parsedPlan` on line 106 (`const { id, user_id, ...planPayload } = parsedPlan as any;`), preventing client-side property injection.
    - Lines 109-112: Checks both `planPayload.simulationConfig?.historicalRange` and `planPayload.historicalRange`. Rejects non-premium users attempting to use `'all_125_years'` or `'most_recent_50_years'` with the exact contract message: `'This feature requires a Premium subscription'`.
    - Lines 114-140 (UPDATE flow): Enforces strict BOLA filtering on lines 123-124 (`.eq('id', id).eq('user_id', user.id)`). Revalidates Next.js cache paths (`/planner` and `/planner/${id}`).
    - Lines 141-166 (INSERT flow): Automatically injects `user_id: user.id` from the secure auth context on line 147. Revalidates Next.js cache paths (`/planner`).
    - Lines 167-173: Enforces clean, non-leaking error handling matching expected user-facing contracts (`Unauthorized` and `Uh oh, the system tripped up! Don't worry, your data is safe. Let's try that again.`).

- **`__tests__/planner/retirementActions.spec.ts`**:
  - Contains 16 comprehensive unit tests covering authentication failures, standard/premium tier lookups, BOLA enforcement on `getPlans`, `getPlan`, and `savePlan`, Zod validation failures, Zod default value population (`numPaths: 1000`, `retirementHorizon: 30`), and premium tier defense enforcement for `all_125_years` and `most_recent_50_years`.

### Independent Verification Results
- Executed command: `export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npm test __tests__/planner/retirementActions.spec.ts`
- Verbatim test output summary:
  ```
  PASS __tests__/planner/retirementActions.spec.ts
    Retirement Server Actions (BOLA & Premium Defenses)
      Authentication & Premium Tier Defenses
        ✓ should return Unauthorized if no user session exists (32 ms)
        ✓ should allow standard tier users to fetch their plans successfully (2 ms)
        ✓ should handle profile DB errors gracefully (12 ms)
      getPlans()
        ✓ should fetch plans successfully for a premium user, filtering by user_id (1 ms)
      getPlan(id)
        ✓ should return error for invalid/empty ID (1 ms)
        ✓ should successfully fetch a specific plan when id and user_id match (2 ms)
        ✓ should return Plan not found or unauthorized if plan does not exist or belongs to another user (BOLA defense) (2 ms)
      savePlan(planData)
        ✓ should return error for invalid plan data failing HouseholdSchema validation (7 ms)
        ✓ should return error for invalid ID format (2 ms)
        ✓ should create a new plan (INSERT) when no id is provided, setting user_id to authenticated user (2 ms)
        ✓ should update an existing plan (UPDATE) when id is provided, enforcing BOLA defense with eq(id) and eq(user_id) (2 ms)
        ✓ should fail update if plan belongs to another user (BOLA defense verification) (5 ms)
        ✓ should correctly apply Zod default values for simulationConfig (numPaths and retirementHorizon) without manual pre-validation mutation (3 ms)
        ✓ should reject savePlan if standard tier user attempts to use premium historicalRange (all_125_years) (1 ms)
        ✓ should reject savePlan if standard tier user attempts to use premium historicalRange (most_recent_50_years) (1 ms)
        ✓ should allow standard tier user to save plan with standard historicalRange (most_recent_20_years) (1 ms)

  Test Suites: 1 passed, 1 total
  Tests:       16 passed, 16 total
  Snapshots:   0 total
  Time:        0.98 s, estimated 1 s
  Ran all test suites matching __tests__/planner/retirementActions.spec.ts.
  ```

---

## 2. Logic Chain

1. **BOLA Defenses Verification**: Across all three server actions (`getPlans`, `getPlan`, `savePlan`), the database queries explicitly bind the operation to the authenticated user's ID (`.eq('user_id', user.id)`). In `savePlan`, `user_id` is stripped from the incoming payload and explicitly overridden by `user.id` obtained directly from `supabase.auth.getUser()`. This makes BOLA exploits impossible within the server actions layer.
2. **Premium Tier Defense Verification**: The check for `historicalRange` inspects both the top-level property and the nested `simulationConfig` property. If the user's tier is not `'premium'`, any attempt to request `'all_125_years'` or `'most_recent_50_years'` is immediately rejected before any database operation occurs.
3. **Eradication of Mock Facades & Pre-validation Mutations**: Direct code inspection confirms that previous mock return facades (`if (id.length !== 36)`, `if (id.includes('malicious'))`) and manual object mutations (`delete dataObj.id`) have been fully eradicated. Data parsing relies entirely on `HouseholdSchema.safeParse` with native defaults.
4. **Integrity & Conformance Check**: The test suite executes against the real action logic using appropriate mocks for the Supabase client and Next.js cache revalidation. No test results or expected outputs are hardcoded in the source code, confirming zero integrity violations.

---

## 3. Caveats

- **No caveats.** The implementation is fully verified, hermetic within the server actions scope, and achieves 100% passing test execution across all 16 defined test cases.

---

## 4. Conclusion

### Review Summary
**Verdict**: APPROVE / PASS

### Findings
- **None.** The implementation meets and exceeds all requirements for correctness, completeness, robustness, and interface conformance.

### Verified Claims
- **Strict BOLA defenses** → verified via code inspection and unit tests → PASS
- **Robust Premium tier checks** → verified via code inspection and unit tests → PASS
- **Zod validation with native defaults** → verified via code inspection and unit tests → PASS
- **Absence of mock return facades & mutations** → verified via direct code inspection → PASS
- **100% passing unit tests (16/16)** → verified via `npm test` execution → PASS

### Adversarial Challenge Summary
**Overall risk assessment**: LOW

#### Stress Test Results
- **Scenario 1 (BOLA Attack on UPDATE)**: Attacker attempts to update an existing plan owned by another user by passing a valid `id` but where `user_id` does not match the authenticated session.
  - *Expected behavior*: Supabase query `.eq('id', id).eq('user_id', user.id)` matches 0 rows; action returns `Failed to update plan or unauthorized modification`.
  - *Actual behavior*: Successfully tested and confirmed in unit tests (`should fail update if plan belongs to another user (BOLA defense verification)`). → PASS
- **Scenario 2 (Premium Feature Bypass)**: Free/standard user attempts to bypass UI restrictions and send a direct POST payload with `historicalRange: 'all_125_years'`.
  - *Expected behavior*: Action rejects request with `This feature requires a Premium subscription` without calling Supabase `update`/`insert`.
  - *Actual behavior*: Successfully tested and confirmed in unit tests. → PASS
- **Scenario 3 (Payload Injection)**: Attacker passes an object with a crafted `user_id` property in `planData` to overwrite ownership during `insert`.
  - *Expected behavior*: `savePlan` destructures `user_id` out of `parsedPlan` and explicitly assigns `user_id: user.id` from `getUserAndTier`.
  - *Actual behavior*: Confirmed via code inspection (`const { id, user_id, ...planPayload } = parsedPlan as any;`). → PASS

---

## 5. Verification Method

To independently verify the results of this review, execute the following command in the terminal from the project root (`/usr/local/google/home/duynguyenn/expense-dashboard`):

```bash
export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npm test __tests__/planner/retirementActions.spec.ts
```

**Expected Output**:
```
Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
Snapshots:   0 total
Time:        0.98 s, estimated 1 s
Ran all test suites matching __tests__/planner/retirementActions.spec.ts.
```

**Invalidation Conditions**:
- Any modification to `src/app/actions/retirementActions.ts` that removes `.eq('user_id', user.id)` checks or bypasses `HouseholdSchema.safeParse`.
