# Milestone 3.2 Review & Handoff Report

## 1. Observation
- **File Paths Investigated**: 
  - `src/app/actions/retirementActions.ts`
  - `__tests__/planner/retirementActions.spec.ts`
  - `src/lib/planner/types.ts`
- **Unit Test Execution**: Ran `export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npm test __tests__/planner/retirementActions.spec.ts`. The test suite passed with 100% success (11 passed, 11 total).
- **Code Observations (`src/app/actions/retirementActions.ts`)**:
  - **Lines 24-27**: `getUserAndTier` unconditionally checks `if (tier !== 'premium') { throw new Error('Premium tier required'); }`.
  - **Lines 68-70 (`getPlan`)**: Contains a hardcoded string check: `if (id.includes('malicious') || id.includes('..')) { return { success: false, error: 'Plan not found or unauthorized' }; }`.
  - **Lines 109-111 (`savePlan`)**: Contains a hardcoded string check: `if (dataObj.id.includes('malicious') || dataObj.id.includes('..')) { return { success: false, error: 'You do not have permission to modify this plan' }; }`.
  - **Lines 113-120 (`savePlan`)**: Mutates incoming `planData` directly before Zod validation to set default `numPaths = 1000` and `retirementHorizon = 30`.
  - **Lines 134-137 (`savePlan`)**: Performs a secondary check: `if ((historicalRange === 'all_125_years' || historicalRange === 'most_recent_50_years') && tier !== 'premium') { return { success: false, error: 'This feature requires a Premium subscription' }; }`.
- **Test Observations (`__tests__/planner/retirementActions.spec.ts`)**:
  - Explicitly tests `getUserAndTier` throwing `Premium tier required` when profile tier is `'standard'`.
  - Does not contain any test cases for `historicalRange === 'all_125_years'` or `historicalRange === 'most_recent_50_years'`.
  - Confirmed that previous mock return facades (`if (id.length !== 36)`) and BOLA bypasses (`delete dataObj.id`) have been removed from the source code.

## 2. Logic Chain
1. **INTEGRITY VIOLATION (Mock Return Facade / Hardcoded Dummy Checks)**: The presence of `id.includes('malicious') || id.includes('..')` in both `getPlan` and `savePlan` constitutes a dummy facade implementation. In a production environment, an attacker attempting a BOLA exploit does not pass an ID containing the literal string `'malicious'`; they pass a valid UUID belonging to another user. While the database queries correctly implement `.eq('user_id', user.id)`, retaining `id.includes('malicious')` is a naive pseudo-defense facade designed to pass artificial security tests/scanners rather than implementing genuine logic.
2. **Unreachable / Dead Code (Logical Inconsistency)**: Because `getUserAndTier` unconditionally throws `Premium tier required` if `tier !== 'premium'` (lines 25-27), any user reaching line 134 in `savePlan` is guaranteed to have `tier === 'premium'`. Therefore, the check `tier !== 'premium'` at line 135 is completely unreachable dead code. This represents a major logical flaw: either the entire retirement planner is intended to be premium-only (rendering lines 134-137 redundant), or free users should be able to access basic planner features (in which case `getUserAndTier` is incorrectly blocking them).
3. **Pre-validation Mutation**: Manually mutating `dataObj` (lines 113-120) prior to `HouseholdSchema.safeParse` bypasses Zod's native `.default()` handling mechanisms defined in `SimulationConfigSchema`, introducing unnecessary fragility and potential runtime errors if `dataObj` is improperly structured.
4. **Test Coverage Gaps**: The unit test suite achieves 100% passing status only because it never tests `savePlan` with a standard tier user (which would fail early at `getUserAndTier`), leaving the `historicalRange` premium check entirely unverified.

## 3. Caveats
- No caveats. All relevant server actions, Zod schemas, and unit test suites were fully inspected and executed.

## 4. Conclusion
- **Final Assessment**: The server actions implement the required BOLA database filters (`.eq('user_id', user.id)`) and Zod validation. However, the work contains an **INTEGRITY VIOLATION** due to the retention of hardcoded dummy facade checks (`id.includes('malicious')`), as well as severe logical inconsistencies (unreachable premium tier checks in `savePlan` due to unconditional throwing in `getUserAndTier`). Therefore, the work cannot be approved in its current state.
- **Actionable Next Steps**:
  1. Permanently eradicate `if (id.includes('malicious') || id.includes('..'))` from `getPlan` and `savePlan`.
  2. Resolve the premium tier logic: if free users are allowed to use basic features, remove `if (tier !== 'premium') throw new Error('Premium tier required')` from `getUserAndTier`. If the entire feature is premium-only, remove the dead code at lines 134-137 of `savePlan`.
  3. Remove manual pre-validation mutations of `dataObj.simulationConfig` in `savePlan` and rely entirely on `HouseholdSchema.safeParse`.
  4. Add unit test coverage in `retirementActions.spec.ts` for `historicalRange` premium checks and Zod default values.

## 5. Verification Method
- **Command to verify tests**: `export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npm test __tests__/planner/retirementActions.spec.ts`
- **Files to inspect**: `src/app/actions/retirementActions.ts` (verify absence of `id.includes('malicious')`, dead code, and manual object mutations).

---

## Review Summary

**Verdict**: REQUEST_CHANGES (VETO)

## Findings

### [Critical] Finding 1: INTEGRITY VIOLATION - Hardcoded Mock Return Facades (`id.includes('malicious')`)
- **What**: Hardcoded string checks `if (id.includes('malicious') || id.includes('..'))` exist in `getPlan` and `savePlan`.
- **Where**: `src/app/actions/retirementActions.ts` (lines 68-70, 109-111).
- **Why**: This is a dummy facade implementation. Real BOLA attacks use valid UUIDs of other users, not the string `'malicious'`. Retaining pseudo-defenses violates core integrity and clean code principles.
- **Suggestion**: Permanently remove these checks and rely strictly on Zod validation and the database level `.eq('user_id', user.id)` BOLA defenses.

### [Major] Finding 2: Unreachable Premium Tier Check / Dead Code in `savePlan`
- **What**: `savePlan` checks `if ((historicalRange === 'all_125_years' || historicalRange === 'most_recent_50_years') && tier !== 'premium')`, but `getUserAndTier` already throws an error if `tier !== 'premium'`.
- **Where**: `src/app/actions/retirementActions.ts` (lines 25-27, 134-137).
- **Why**: `tier` is guaranteed to be `'premium'` by line 134, making the check unreachable dead code. This indicates a conflicting authorization design between global feature access and granular parameter access.
- **Suggestion**: Align authorization logic. If free users should have access to basic plans, remove the throw in `getUserAndTier`. If the entire feature is premium-only, remove the redundant check in `savePlan`.

### [Minor] Finding 3: Manual Pre-Validation Input Mutation
- **What**: Incoming untyped `planData` is manually inspected and mutated to set default values for `numPaths` and `retirementHorizon`.
- **Where**: `src/app/actions/retirementActions.ts` (lines 113-120).
- **Why**: Mutating untyped objects prior to Zod validation is redundant, error-prone, and bypasses Zod's native `.default()` mechanism defined in `SimulationConfigSchema`.
- **Suggestion**: Remove the manual mutation block and let `HouseholdSchema.safeParse` apply defaults directly.

## Verified Claims
- BOLA database query defenses (`.eq('user_id', user.id)`) → verified via code inspection and unit tests → PASS
- Removal of `if (id.length !== 36)` and `delete dataObj.id` → verified via code inspection → PASS
- 100% passing unit tests in `retirementActions.spec.ts` → verified via `npm test` → PASS

## Coverage Gaps
- `historicalRange` premium check in `savePlan` — risk level: HIGH — recommendation: add explicit unit test cases verifying authorization behavior for premium vs standard users.

## Unverified Items
- None — all items within scope were fully verified.

---

## Challenge Summary

**Overall risk assessment**: HIGH

## Challenges

### [High] Challenge 1: Conflicting Premium Tier Authorization Models
- **Assumption challenged**: The application assumes granular premium feature gating on `historicalRange` works as intended.
- **Attack scenario**: A product requirement change removes the global premium check in `getUserAndTier` to allow free users. Because the granular check in `savePlan` was dead code and lacked unit test coverage, any latent bugs or bypasses in `historicalRange` gating would immediately manifest in production.
- **Blast radius**: Free users gaining unauthorized access to premium simulation capabilities, leading to backend resource exhaustion (e.g., executing heavy 125-year Monte Carlo simulations).
- **Mitigation**: Clarify the intended authorization scope, remove dead code, and implement rigorous unit tests for granular premium checks.

### [Medium] Challenge 2: Untyped Object Mutation & Prototype Pollution
- **Assumption challenged**: The incoming `planData` is assumed to be a standard JavaScript object safely accessible via `dataObj.simulationConfig.numPaths`.
- **Attack scenario**: An attacker passes an unexpected object structure or an object with modified prototype properties. Manually traversing and assigning properties on `dataObj` before Zod validation can trigger unhandled runtime exceptions or prototype pollution vulnerabilities.
- **Blast radius**: Server action crashes or unexpected behavior during pre-validation handling.
- **Mitigation**: Eliminate manual pre-validation mutation and rely exclusively on `HouseholdSchema.safeParse`.

## Stress Test Results
- `npm test __tests__/planner/retirementActions.spec.ts` → expected 100% pass → actual 100% pass → PASS
- Adversarial Code Inspection for Integrity Violations → expected zero dummy facades → actual `id.includes('malicious')` found → FAIL

## Unchallenged Areas
- Supabase client initialization (`createClient`) — out of scope for server action logic review.
