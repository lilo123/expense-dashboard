# Handoff Report: M5.1 Tier 1 Feature Coverage Analysis (Gen 1 Replacement)

## 1. Observation
During our read-only investigation of `e2e/planner_tier1_feature.spec.ts` and related application code, we executed `export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npx tsx e2e/run_e2e.ts` and analyzed the codebase. We directly observed the following fatal errors, missing locators, and logic misalignments:

1. **Next.js RSC Web Server Build Failure**:
   - **Verbatim Error**: `You're importing a module that depends on useEffect into a React Server Component module. This API is only available in Client Components. To fix, mark the file (or its parent) with the "use client" directive.`
   - **File & Line**: `src/store/useRetirementStore.tsx:1:69`, imported directly by Server Component `src/app/plans/[id]/page.tsx`. `src/store/useRetirementStore.tsx` lacks the `"use client";` directive at the top.

2. **Login Redirect Parameter Ignored**:
   - **File & Line**: `src/app/(auth)/login/page.tsx`, lines 123-126.
   - **Observation**: On successful authentication, `handleAuth` unconditionally executes `window.location.href = '/dashboard';`, completely ignoring `searchParams.get('redirect')`. E2E Test 3 expects redirection to `/plans/new?currentAge=35`.

3. **Quick Check Widget Missing Locators & Parameters**:
   - **File & Line**: `src/components/QuickCheckWidget.tsx`, lines 11-17, 74-82, 85.
   - **Observation**: The outer wrapper lacks `id="quick-check-widget"`. The form inputs lack `id="quick-current-age"`, `id="quick-retirement-age"`, `id="quick-current-savings"`, `id="quick-monthly-contribution"`. The submit button lacks `id="save-unlock-btn"` and routes to `/plans/new` directly rather than `/login?redirect=` with `currentAge`, `retirementAge`, `currentSavings`, `monthlyContribution`.

4. **Zustand Store Hydration & Schema Gaps**:
   - **File & Line**: `src/store/useRetirementStore.tsx`, lines 20-46, 125-146; `src/lib/planner/types.ts`, lines 4-18.
   - **Observation**: `hydrateFromParams` does not parse `currentAge`, `retirementAge`, `currentSavings`, or `monthlyContribution`. `defaultHousehold` sets `birthYear: 1965` and `balance: 1000000`, whereas E2E Test 5 expects default `currentAge` to be `30` (birthYear 1996) and `currentSavings` to be `0`. `AccountSchema` in `types.ts` lacks `monthlyContribution`.

5. **Detailed Plan Builder UI Locators & Validation Gaps**:
   - **File & Line**: `src/components/PlanBuilder.tsx`, lines 15-23, 73-87, 95-137, 145-175.
   - **Observation**: Tab buttons lack `id="tab-<id>"` and do not append the class `'active'` when active. `#hydrated-marker` is missing entirely. Household tab uses `id="plan-name"` instead of `id="input-plan-name"`, and lacks `#input-current-age` and `#input-retirement-age`. There is no `.validation-error` element rendered when age is invalid (E2E Test 8). Accounts tab lacks `#input-current-savings` and `#input-monthly-contribution`. Save button lacks `id="save-plan-btn"`. Save toast lacks `.toast-success` and `.toast-error`. Tab panels lack `id="panel-<id>"`. `ActiveTab` in `useRetirementStore.tsx` and `PlanBuilder.tsx` lacks the `'taxes'` tab entirely (uses `summary` instead), causing E2E Test 7 (`#tab-taxes`, `#tab-events`) to fail.

6. **Simulation Tab Locators & Screen Reader Parity Gaps**:
   - **File & Line**: `src/components/SimulationTab.tsx`, lines 41-75, 78-83, 92-103.
   - **Observation**: Premium lock overlay lacks `id="premium-lock-card"`, uses `bg-white/60` instead of `bg-white/40`, and `border-white/40` instead of `border-white/20`. Range buttons lack `id="range-20yr"`, `id="range-50yr"`, `id="range-125yr"` and do not match E2E premium entitlement expectations (`most_recent_20_years` enabled for standard users, `most_recent_50_years` and `all_125_years` disabled). Run button lacks `id="run-simulation-btn"`. Results container lacks `id="simulation-results-summary"` and does not display the projection range text or path count (`125-Year Projection`, `1,000 paths simulated`). `#wealth-fan-chart` and `div.sr-only table` are missing entirely (E2E Test 10).

7. **Server Actions BOLA Defenses & RLS Enforcement Flaws**:
   - **File & Line**: `src/app/actions/retirementActions.ts`, lines 7-29, 31-59, 61-91, 93-171; `src/app/plans/[id]/page.tsx`, lines 18-20; `src/app/plans/page.tsx`, lines 27-37.
   - **Observation**: `requirePremiumUser` is called unconditionally in `getPlans`, `getPlan`, and `savePlan`, blocking standard users from viewing or saving their own plans (violating E2E Tests 6, 16, 17). `src/app/plans/page.tsx` lacks `id="plans-dashboard-container"`. `src/app/plans/[id]/page.tsx` calls `notFound()` on failure instead of redirecting to `/plans?error=...` (E2E Test 19). `PlanBuilder.tsx` lacks a `<form>` wrapper, preventing `document.querySelector('form')` from appending the hidden input in E2E Test 18 to verify BOLA premium parameter rejection in `savePlan`.

## 2. Logic Chain
1. **RSC Error**: Because `useRetirementStore.tsx` defines `RetirementStoreProvider` using React client hooks (`useState`, `useEffect`, etc.), it must be marked with `"use client";`. Without it, importing it into `src/app/plans/[id]/page.tsx` causes Next.js to bundle it as a Server Component, throwing a fatal build error.
2. **Login Redirect**: E2E Test 3 passes `?redirect=...` to `/login`. Since `login/page.tsx` hardcodes `window.location.href = '/dashboard'`, the user is never sent to `/plans/new`, breaking the entire E2E hydration flow.
3. **Quick Check & Hydration**: E2E Tests 1-5 depend on specific input IDs (`#quick-current-age`, `#input-current-age`, etc.) and URL parameters (`currentAge`, `retirementAge`, `currentSavings`, `monthlyContribution`). Because `QuickCheckWidget.tsx`, `useRetirementStore.tsx`, and `PlanBuilder.tsx` use different parameter names (`portfolio`, `withdrawal`, `birthYear`) and lack these IDs, Playwright cannot locate the elements or verify store hydration.
4. **Plan Builder & Simulation UI**: E2E Tests 7-15 expect specific DOM structures (`#wealth-fan-chart`, `div.sr-only table`, `#premium-lock-card`, `#range-20yr`, `#run-simulation-btn`, `#simulation-results-summary`, `#tab-taxes`, `#tab-events`, `.validation-error`). Because these elements are missing or improperly styled/named, Playwright assertions fail immediately.
5. **Server Actions & BOLA Defenses**: `requirePremiumUser` throws an error if `profile?.tier !== 'premium'`. Because standard users must be able to view and save standard plans, `getPlans`, `getPlan`, and `savePlan` must use `requireAuthUser` instead. To satisfy E2E Test 18, `PlanBuilder.tsx` must wrap its inputs in a `<form>` so Playwright's `page.evaluate` can append `<input type="hidden" name="historicalRange" value="125" />`. `handleSave` must detect this input and pass `historicalRange: 'all_125_years'` to `savePlan`, where `savePlan` verifies `userTier !== 'premium'` and returns `This feature requires a Premium subscription`. To satisfy E2E Test 19, `src/app/plans/[id]/page.tsx` must redirect unauthorized accesses to `/plans?error=...`, and `src/app/plans/page.tsx` must display this error in `.toast-error`.

## 3. Caveats
- **Read-only constraints**: As an Explorer agent, we have not modified any files or executed write operations. All findings are based on static analysis and E2E test execution logs.
- **Assumptions**: We assume the environment variables and Supabase mock schemas provided by `e2e/run_e2e.ts` are correct and fully functional. No other caveats.

## 4. Conclusion
The implementation contains clear, actionable gaps between the frontend component structure/server actions and the rigorous expectations of `e2e/planner_tier1_feature.spec.ts`. By applying precise adjustments to `useRetirementStore.tsx`, `login/page.tsx`, `QuickCheckWidget.tsx`, `PlanBuilder.tsx`, `SimulationTab.tsx`, `types.ts`, `retirementActions.ts`, `plans/page.tsx`, and `plans/[id]/page.tsx`, the Worker agent will successfully achieve a 100% pass rate across all Tier 1 E2E tests.

## 5. Verification Method
To verify the correctness of the recommended fixes independently, the Worker and Reviewer agents must execute the following verification commands:

1. **Verify E2E Tests**:
   ```bash
   export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH; npx tsx e2e/run_e2e.ts
   ```
   - **Success Criteria**: Process exits with code `0`, confirming 100% of the test cases pass successfully across all assertions and automated accessibility audits.

2. **Verify Local Git Status**:
   ```bash
   git status
   ```
   - **Success Criteria**: All modifications exist strictly in the local working directory with zero commits pushed to remote repositories.
