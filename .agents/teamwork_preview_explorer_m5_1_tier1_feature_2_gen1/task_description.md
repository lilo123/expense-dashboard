# Task Description: Explorer - M5.1 Tier 1 Feature Coverage Analysis (Iteration 2)

## Identity & Working Directory
- **Role**: Explorer (Read-only exploration agent)
- **Working Directory**: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m5_1_tier1_feature_2_gen1`

## Clear Objective
- Analyze `e2e/planner_tier1_feature.spec.ts`, `e2e/planner_tier2_boundary.spec.ts`, `e2e/planner_tier3_pairwise.spec.ts`, `e2e/planner_tier4_workload.spec.ts`, and related application code.
- Review the previous failure output and review feedback from Iteration 1 (detailed below) where 92 tests failed out of 152.
- Recommend a precise, actionable fix strategy for the Worker in Iteration 2 to address all identified failure modes.

## Previous Failure Output & Review Feedback (Iteration 1)
Independent execution of `npx tsx e2e/run_e2e.ts` in Iteration 1 revealed `92 failed, 60 passed` out of 152 tests. Key failure modes include:
1. **`src/app/page.tsx` (Landing Page Accessibility / Color Contrast)**:
   - Fails on `@axe-core/playwright` automated accessibility audit with `color-contrast` violations (`Element has insufficient color contrast of 2.75... Expected contrast ratio of 4.5:1` on `© 2026 An-yen Studio. All rights reserved.`, `Terms of Service`, `Privacy Policy`). Hardcoded footer text colors (`#94989f` on `#faf9f6`) violate WCAG 2 AA minimum contrast ratio thresholds (2.75 vs 4.5:1). Must change text color to something darker (e.g. `#4a4d53` or `#000000`).
2. **`src/components/QuickCheckWidget.tsx` (URL parameter encoding mismatch)**:
   - Fails `expect(url).toContain('currentAge=35')` because the redirect URL encodes the search params as `%3FcurrentAge%3D35...`. `Expected substring: "currentAge=35", Received string: "http://localhost:3000/login?redirect=%2Fplans%2Fnew%3FcurrentAge%3D35%26retirementAge%3D65..."`. `handleBuildPlan` must construct the URL such that `currentAge=35` appears literally in the URL (e.g. `/login?redirect=/plans/new&currentAge=35...` or `/login?redirect=/plans/new?currentAge=35...` without `encodeURIComponent` on the query string).
3. **`src/app/plans/page.tsx` (`#plans-dashboard-container` visibility)**:
   - Fails `expect(locator('#plans-dashboard-container')).toBeVisible()`. `Error: element(s) not found`. Ensure `getPlans()` in `retirementActions.ts` correctly handles standard users and `#plans-dashboard-container` is properly placed.
4. **`src/components/PlanBuilder.tsx` (`onBlur` validation and cross-field rules)**:
   - Fails `e2e/planner_tier2_boundary.spec.ts:147:53` (Test 8): validation for `Retirement age cannot be less than current age` is not implemented.
   - Fails `e2e/planner_tier2_boundary.spec.ts:132`: lacks `onBlur` validation for `#input-retirement-age` (`"Retirement age must be between 50 and 80"`). When an invalid retirement age (`49`) is entered, no `.validation-error` is rendered. Must add `onBlur` handlers to both `#input-current-age` and `#input-retirement-age` that check Zod rules and cross-field rules (`age < 0`, `retirementAge < 50 || retirementAge > 80`, `retirementAge < currentAge`), setting the appropriate error message in `.validation-error`.
5. **`src/components/SimulationTab.tsx` (`#wealth-fan-chart`, `#premium-lock-card`, `.toast-error`, `#range-50yr`)**:
   - Fails `expect(locator('#wealth-fan-chart')).toBeVisible()`.
   - Fails `expect(locator('#premium-lock-card')).toBeVisible()`.
   - Fails `expect(page.locator('#range-50yr')).toBeDisabled()` (received enabled).
   - Fails `e2e/planner_tier2_boundary.spec.ts:198`: `Expected substring: "This feature requires a Premium subscription". Timeout: 15000ms. Error: element(s) not found - waiting for locator('.toast-error')`. `SimulationTab.tsx` displays `store.error` in a container lacking the `.toast-error` class. Must add `toast-error` to `className`.
   - Session Cache Leakage Across Tests: `SimulationTab.tsx` utilizes `supabase.auth.getUser()` inside `useEffect` to set `effectiveTier`, which pulls cached session state from previous test executions if browser contexts are not strictly purged. Standard users inherit the cached session of preceding premium users (`effectiveTier === 'premium'`). This prevents `#premium-lock-card` from rendering, causing failures across Tier 3 and Tier 4 tests. Investigate robust ways to determine `effectiveTier` (e.g. checking `store.userTier` or freshly fetching profile/session).
6. **`src/app/actions/retirementActions.ts` (BOLA enforcement bypass on top-level `historicalRange`)**:
   - In `savePlan`, BOLA checks verify `planPayload.simulationConfig?.historicalRange` but fail to check `planPayload.historicalRange`, allowing top-level parameter injection to bypass BOLA rejection. When `e2e/planner_tier2_boundary.spec.ts:379` injects `historicalRange` at the top level of the payload, `savePlan` skips the BOLA rejection and attempts a database insert, returning `"Failed to create retirement plan"` instead of `"This feature requires a Premium subscription"`. Must check both `planPayload.simulationConfig?.historicalRange` and `planPayload.historicalRange`.
7. **`e2e/planner_tier3_pairwise.spec.ts:733:26` (URL assertion failure due to appended query error parameters)**:
   - Fails on `expect(page).toHaveURL(/\/plans$/)` due to appended query error parameters (`http://localhost:3000/plans?error=You+do+not+have+permission+to+view+this+plan`). If the test expects `toHaveURL(/\/plans$/)` (ending in `/plans`), `src/app/plans/page.tsx` can use `window.history.replaceState({}, '', '/plans')` in a client `useEffect` to strip the query parameter immediately after reading/displaying it in `.toast-error`, or `src/app/plans/[id]/page.tsx` can use cookies (`cookies().set('error', ...)`).

## Scope Boundaries
- **DO NOT** modify, create, or delete any source code or test files. You are a read-only exploration agent.
- **DO NOT** execute any commands that modify state. You may inspect files and run read-only/test commands if needed to gather failure logs or analyze state.

## Input Information
- Target Test Files: `e2e/*.spec.ts`
- Test Ready Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/TEST_READY.md`
- Project Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`
- Scope Spec: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m5_1_tier1_feature_1/SCOPE.md`
- Application Code: `src/lib/planner/*.ts`, `src/store/useRetirementStore.tsx`, `src/app/page.tsx`, `src/app/(dashboard)/plans/**`, `src/app/actions/retirementActions.ts`, etc.

## Output Requirements
- Write a structured handoff report in your working directory named `handoff.md` following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Include verified evidence chains with exact file paths and line numbers for any recommended fixes.

## Completion Criteria
- `handoff.md` is fully populated and saved in your working directory.
- Send a message back to your parent orchestrator confirming completion and providing the path to your `handoff.md`.
