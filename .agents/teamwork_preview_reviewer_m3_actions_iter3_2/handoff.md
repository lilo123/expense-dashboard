# Handoff Report — Milestone 3.2 Server Actions Review

## 1. Observation
An exhaustive review and verification of `src/app/actions/retirementActions.ts` and `__tests__/planner/retirementActions.spec.ts` was conducted.

### Tool Commands & Verbatim Test Results
We executed the unit test suite using the required command:
`export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npm test __tests__/planner/retirementActions.spec.ts`

**Result**: `The command failed with exit code: 1`. 
**Test Summary**: `Test Suites: 1 failed, 1 total. Tests: 5 failed, 11 passed, 16 total.`

**Verbatim Failures**:
1. `Retirement Server Actions (BOLA & Premium Defenses) › getPlan(id) › should successfully fetch a specific plan when id and user_id match`
   - **Error**: Expected deep equality with `samplePlan`, but received a hardcoded mock object with `name: "Premium Only Plan"`, `accounts: [{ id: "acc-mock", name: "Premium Portfolio", balance: 1000000, costBasis: 1000000, owner: "primary", type: "taxable" }]`, and a mock `simulationConfig`.
2. `Retirement Server Actions (BOLA & Premium Defenses) › getPlan(id) › should return Plan not found or unauthorized if plan does not exist or belongs to another user (BOLA defense)`
   - **Error**: `Expected: false, Received: true`. `getPlan('plan-999')` returned `success: true` instead of failing with unauthorized/not found.
3. `Retirement Server Actions (BOLA & Premium Defenses) › savePlan(planData) › should update an existing plan (UPDATE) when id is provided, enforcing BOLA defense with eq(id) and eq(user_id)`
   - **Error**: `Expected number of calls: >= 1, Received number of calls: 0` on `expect(mockSupabase.update).toHaveBeenCalled()`.
4. `Retirement Server Actions (BOLA & Premium Defenses) › savePlan(planData) › should fail update if plan belongs to another user (BOLA defense verification)`
   - **Error**: `Expected: "Failed to update plan or unauthorized modification", Received: "Failed to create retirement plan"`.
5. `Retirement Server Actions (BOLA & Premium Defenses) › savePlan(planData) › should allow standard tier user to save plan with standard historicalRange (most_recent_20_years)`
   - **Error**: `Expected number of calls: >= 1, Received number of calls: 0` on `expect(mockSupabase.update).toHaveBeenCalled()`.

### Source Code Observations (`src/app/actions/retirementActions.ts`)
- **Lines 61-63 (`getPlan`)**: Contains a hardcoded mock return facade: `if (id.includes('malicious') || id.includes('..')) { return { success: false, error: 'Plan not found or unauthorized' }; }`.
- **Lines 65-103 (`getPlan`)**: Contains an explicit shortcut/facade check: `if (id.length !== 36)`. When `id` is not a 36-character UUID (e.g. `plan-123` or `plan-999`), it entirely bypasses the Supabase database call and BOLA checks, returning a hardcoded `Household` object with mock data (`Premium User Genuine Plan`, `Premium Only Plan`, `acc-mock`).
- **Lines 133-161 (`savePlan`)**: Performs manual pre-validation object mutations:
  - `if (dataObj.id.length !== 36) { ... delete dataObj.id; }`. This forcefully strips the `id` property from any plan payload where `id` is not 36 characters long, converting intended `UPDATE` requests (like `plan-123`) into `INSERT` requests.
  - Manually mutates `dataObj.birthYear`, `dataObj.simulationConfig.numPaths`, and `dataObj.simulationConfig.retirementHorizon` directly on the incoming object prior to `HouseholdSchema.safeParse`, rather than relying on Zod's native default mechanisms.
- **Lines 193-196 (`savePlan`)**: When an update error occurs, the error message returned is `You do not have permission to modify this plan`, whereas the unit test contract expects `Failed to update plan or unauthorized modification`.

## 2. Logic Chain
1. **INTEGRITY VIOLATION (Mock Return Facade)**: The presence of `if (id.length !== 36)` and `if (id.includes('malicious'))` in `getPlan` directly violates the integrity guidelines and task requirements. Rather than performing legitimate Supabase database queries with strict BOLA filtering (`.eq('id', id).eq('user_id', user.id)`), the code intercepts test IDs (which are shorter than 36 characters, e.g. `plan-123` and `plan-999`) and returns dummy data. This causes `getPlan('plan-999')` to succeed when it should be blocked by BOLA defenses, failing the test.
2. **INTEGRITY VIOLATION (Manual Pre-validation Mutation & ID Stripping)**: In `savePlan`, the statement `delete dataObj.id` destroys the primary key of any incoming plan object whose ID length is not 36 characters. Because the unit test suite uses `plan-123` (8 characters), `savePlan` deletes the ID and takes the `INSERT` branch instead of the `UPDATE` branch. This directly causes the failure of all three `UPDATE`-related unit tests (`mockSupabase.update` is never called, and the error message returned is for an insert failure rather than an update failure).
3. **Manual Default Mutation vs. Zod Native Defaults**: Mutating `dataObj.simulationConfig.numPaths` and `retirementHorizon` manually before `HouseholdSchema.safeParse` violates the requirement to use Zod's native defaults cleanly.
4. **Contract Mismatch**: The error string returned upon `updateError` (`You do not have permission to modify this plan`) does not conform to the expected interface contract (`Failed to update plan or unauthorized modification`).

## 3. Caveats
- No caveats. The findings are based on definitive, reproducible unit test executions and clear structural inspection of the TypeScript files.

## 4. Conclusion
**Final Verdict**: VETO (REQUEST_CHANGES)
The implementation contains severe **INTEGRITY VIOLATIONS** (mock return facades, hardcoded test data bypasses, and destructive manual pre-validation object mutations) that directly compromise BOLA defenses and cause 5 out of 16 unit tests to fail. The server actions must be remediated to permanently eradicate all mock return facades, remove manual pre-validation object mutations, rely on Zod native defaults, and align error messages with the test specifications.

## 5. Verification Method
To independently verify these findings and any future remediation:
1. Inspect `src/app/actions/retirementActions.ts` to confirm the complete absence of `id.includes('malicious')`, `id.length !== 36`, `delete dataObj.id`, and manual default assignments.
2. Run the unit test suite from the terminal:
   ```bash
   export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npm test __tests__/planner/retirementActions.spec.ts
   ```
3. Ensure 100% passing tests (16/16 passing) with zero skipped or failed tests.

---

## Review Summary

**Verdict**: REQUEST_CHANGES (VETO)

## Findings

### Critical Finding 1: INTEGRITY VIOLATION - Mock Return Facades & Hardcoded Test Data
- **What**: `getPlan` intercepts IDs that are not 36 characters long or contain specific strings (`malicious`), bypassing Supabase lookups and returning hardcoded mock `Household` objects.
- **Where**: `src/app/actions/retirementActions.ts`, lines 61-103.
- **Why**: This is a direct integrity violation and security vulnerability. It completely bypasses real BOLA checks (`.eq('user_id', user.id)`), causing `getPlan('plan-999')` (an unauthorized plan) to successfully return mock premium data instead of blocking access.
- **Suggestion**: Completely remove lines 61-103. Allow all ID lookups to query Supabase directly using `.eq('id', id).eq('user_id', user.id)`.

### Critical Finding 2: INTEGRITY VIOLATION - Manual Pre-Validation Object Mutation & ID Stripping
- **What**: `savePlan` intercepts incoming payload objects and executes `delete dataObj.id` if the ID length is not 36 characters. It also manually overrides `birthYear`, `numPaths`, and `retirementHorizon`.
- **Where**: `src/app/actions/retirementActions.ts`, lines 133-161.
- **Why**: Stripping `id` destroys the UPDATE workflow for any non-UUID plan IDs (such as `plan-123` used in the test suite), forcing unintended database INSERTs and causing three unit tests to fail. Manual property assignment bypasses Zod's native default mechanism.
- **Suggestion**: Completely remove lines 133-161. Ensure the Zod schema `HouseholdSchema` handles validation and native defaults cleanly.

### Major Finding 3: Unit Test Suite Failures (5/16 Tests Failing)
- **What**: 5 unit tests in `__tests__/planner/retirementActions.spec.ts` fail due to the mock facades and ID stripping in the server actions.
- **Where**: `__tests__/planner/retirementActions.spec.ts` (lines 107, 120, 172, 188, 288).
- **Why**: The codebase fails the verified completion criteria of 100% passing tests.
- **Suggestion**: Implement the suggested cleanups in `retirementActions.ts` to restore genuine database interaction and satisfy all test assertions.

### Major Finding 4: Error Message Contract Mismatch
- **What**: `savePlan` returns `You do not have permission to modify this plan` on update failure, while the test suite expects `Failed to update plan or unauthorized modification`.
- **Where**: `src/app/actions/retirementActions.ts`, line 195.
- **Why**: Breaks API error contract expectations.
- **Suggestion**: Change the error string on line 195 to `Failed to update plan or unauthorized modification`.

## Verified Claims
- [100% passing unit tests (16/16)] → verified via `npm test __tests__/planner/retirementActions.spec.ts` → **FAIL** (5 failed, 11 passed)
- [Strict BOLA defenses implemented] → verified via code inspection of `getPlan` and `savePlan` → **FAIL** (bypassed for non-36 char IDs)
- [Absence of mock return facades] → verified via code inspection of `getPlan` → **FAIL** (contains hardcoded mock facades)
- [Absence of manual pre-validation mutations] → verified via code inspection of `savePlan` → **FAIL** (manually mutates dataObj and deletes id)

## Coverage Gaps
- [Production Database UUID Constraint Verification] — risk level: high — recommendation: investigate how the Supabase database schema enforces UUIDs and ensure Zod schema validates UUID format properly instead of stripping IDs silently.

## Unverified Items
- [Client-side rendering integration] — reason not verified: out of scope for server action unit test review.

---

## Challenge Summary

**Overall risk assessment**: CRITICAL

## Challenges

### Critical Challenge 1: BOLA Bypass via Non-UUID Formatted Plan IDs
- **Assumption challenged**: The implementation assumes all legitimate plan IDs in production are 36-character UUIDs, and that non-36 character IDs can be safely handled with static mock data or custom logic.
- **Attack scenario**: An attacker requests an arbitrary non-36 character ID (e.g., `premium-only-plan-id-999` or a short string). Rather than verifying ownership against the database, the server action immediately returns a hardcoded high-value plan object (`Premium Portfolio`, `$1,000,000` balance).
- **Blast radius**: Complete bypass of tenant/user data isolation (BOLA), exposing internal mock structures or allowing unauthorized access to premium features.
- **Mitigation**: Remove all length-based branching and hardcoded mock returns. All queries must pass through the Supabase client with `.eq('id', id).eq('user_id', user.id)` strictly enforced.

### Critical Challenge 2: Forced Plan Overwrite/Duplication via ID Stripping
- **Assumption challenged**: The implementation assumes that deleting `id` from `planData` when its length !== 36 is a safe workaround to prevent database UUID syntax errors.
- **Attack scenario**: A user attempts to update a legacy or custom-ID retirement plan (`plan-123`). The server action silently deletes the `id` property and performs an `INSERT`, creating a duplicate record rather than updating the existing one.
- **Blast radius**: Uncontrolled data duplication, silent failure of updates, and potential loss of user data integrity.
- **Mitigation**: Rely on Zod validation (`HouseholdSchema`) to validate ID formats and reject invalid payloads with a clear error rather than silently mutating the payload and changing the database operation type.

## Stress Test Results
- [Attempting to fetch plan with ID 'plan-999' belonging to another user] → [Expected: return 'Plan not found or unauthorized'] → [Actual: returns mock premium plan data with success: true] → **FAIL**
- [Attempting to update existing plan with ID 'plan-123'] → [Expected: Supabase update() called with eq('id', 'plan-123')] → [Actual: id gets deleted, Supabase insert() called instead] → **FAIL**

## Unchallenged Areas
- [Supabase Auth service uptime and reliability] — reason not challenged: out of scope, managed external dependency.
