# Handoff Report: M5.1 Tier 1 Feature Coverage Analysis

## 1. Observation
An exhaustive inspection of `e2e/planner_tier1_feature.spec.ts` (20 test cases) and the underlying application codebase revealed several concrete discrepancies and gaps between the current implementation and E2E test expectations:

1. **`src/components/QuickCheckWidget.tsx` (Lines 84-172)**:
   - The root container div lacks `id="quick-check-widget"`.
   - Lacks input fields with IDs `#quick-current-age`, `#quick-retirement-age`, `#quick-current-savings`, `#quick-monthly-contribution`.
   - The submit button lacks `id="save-unlock-btn"`.
   - `handleBuildPlan` pushes directly to `/plans/new?...` instead of redirecting through `/login?redirect=...` with the required parameters (`currentAge`, `retirementAge`, `currentSavings`, `monthlyContribution`).

2. **`src/app/(auth)/login/page.tsx` (Lines 122-126)**:
   - In `handleAuth`, upon successful password sign-in, the application executes `window.location.href = '/dashboard';` unconditionally, failing to inspect or respect `searchParams.get('redirect')`.

3. **`src/store/useRetirementStore.tsx` (Lines 20-46, 125-200)**:
   - `defaultHousehold` initializes with `balance: 1000000` and `birthYear: 1965`, whereas E2E Test 5 expects clean defaults (`currentAge: 30`, `retirementAge: 65`, `currentSavings: 0`).
   - `hydrateFromParams` does not parse `currentAge`, `retirementAge`, `currentSavings`, or `monthlyContribution`.

4. **`src/lib/planner/types.ts` (Lines 109-140)**:
   - `HouseholdSchema` does not explicitly include `currentAge` or `monthlyContribution` properties.

5. **`src/components/PlanBuilder.tsx` (Lines 1-275)**:
   - Missing the `#hydrated-marker` element required by `waitForSelector('#hydrated-marker')`.
   - Tab buttons lack `id="tab-household"`, `id="tab-accounts"`, `id="tab-spending"`, `id="tab-pensions"`, `id="tab-events"`, `id="tab-taxes"`, `id="tab-simulation"`.
   - Missing `taxes` tab in the navigation array and panels.
   - Tab content wrappers lack `id="panel-household"`, `id="panel-accounts"`, `id="panel-spending"`, `id="panel-pensions"`, `id="panel-events"`, `id="panel-taxes"`, `id="panel-simulation"`.
   - Missing `#input-current-age` (with onBlur Zod validation for age < 0 triggering `.validation-error`) and `#input-retirement-age` in the Household panel.
   - Missing `#input-current-savings` and `#input-monthly-contribution` in the Accounts panel.
   - The plan name input has `id="plan-name"` instead of `id="input-plan-name"`.
   - The save button lacks `id="save-plan-btn"`.
   - The save status message lacks `.toast-success` and `.toast-error` class names.
   - Missing an outer `<form>` wrapper to allow `document.querySelector('form')` and adversarial input injection inspection (`input[name="historicalRange"]`) in `handleSave`.

6. **`src/components/SimulationTab.tsx` (Lines 41-104)**:
   - The premium lock overlay lacks `id="premium-lock-card"` and uses `bg-white/60` instead of `bg-white/40` and `border-white/20`.
   - Range selection buttons do not have IDs `#range-20yr`, `#range-50yr`, `#range-125yr`.
   - The run simulation button lacks `id="run-simulation-btn"`.
   - The results container lacks `id="simulation-results-summary"` and does not display the strings `'125-Year Projection'` or `'1,000 paths simulated'`.
   - Missing `#wealth-fan-chart` and adjacent `div.sr-only table` containing `'10th Percentile'`, `'50th Percentile'`, `'90th Percentile'` headers/data.

7. **`src/app/actions/retirementActions.ts` (Lines 7-172)**:
   - `requirePremiumUser` is invoked unconditionally at the start of `getPlans`, `getPlan`, and `savePlan`, which throws an error for standard tier users, breaking baseline functionality for free users.
   - Lacks explicit BOLA defense logic in `savePlan` to reject standard users attempting to save premium configurations (`historicalRange !== 'most_recent_20_years'`).

8. **`src/app/plans/[id]/page.tsx` (Lines 15-20)**:
   - Calls `notFound()` when `getPlan` fails or returns unauthorized, instead of redirecting to `/plans` with an empathetic access denied message.

9. **`src/app/plans/page.tsx` (Lines 27-78)**:
   - The root container lacks `id="plans-dashboard-container"`.
   - Does not accept `searchParams` to check for and render redirected `.toast-error` messages.

---

## 2. Logic Chain
1. **Quick Check & Login Flow**: To satisfy Tests 1-3, `QuickCheckWidget.tsx` must render the expected widget ID, input IDs, and button ID. When clicked, it must encode the user's inputs into `redirect` search params and push to `/login?redirect=...`. Upon successful login, `login/page.tsx` must parse the `redirect` parameter and navigate to `/plans/new?...`.
2. **Store Hydration & Defaults**: To satisfy Tests 4-5, `useRetirementStore.tsx` must define default values matching E2E expectations (`balance: 0`, `currentAge: 30`, `retirementAge: 65`), and `hydrateFromParams` must parse `currentAge`, `retirementAge`, `currentSavings`, and `monthlyContribution`, correctly updating the `household` state. `HouseholdSchema` in `types.ts` must be extended to allow these optional properties.
3. **Plan Builder & Navigation**: To satisfy Tests 6-10 and 20, `PlanBuilder.tsx` and `useRetirementStore.tsx` must include the `taxes` tab. All tab buttons and panels must possess their exact respective DOM IDs. `PlanBuilder.tsx` must render `#hydrated-marker`, `#input-current-age` (with onBlur validation rendering `.validation-error`), `#input-retirement-age`, `#input-current-savings`, `#input-monthly-contribution`, `#input-plan-name`, `#save-plan-btn`, and `.toast-success`/`.toast-error`.
4. **Simulation & Premium Range**: To satisfy Tests 10-15, `SimulationTab.tsx` must render `#premium-lock-card` (with correct styling), `#range-20yr`, `#range-50yr`, `#range-125yr`, `#run-simulation-btn`, `#simulation-results-summary` (with correct projection strings), `#wealth-fan-chart`, and `div.sr-only table`.
5. **Server Actions & BOLA Defenses**: To satisfy Tests 16-19, `retirementActions.ts` must replace `requirePremiumUser` with a helper `getUserAndTier` that returns both the user object and tier without throwing on free tiers. `savePlan` must verify that standard users cannot save a plan with premium parameters (`historicalRange !== 'most_recent_20_years'`). `PlanBuilder.tsx` must wrap its content in a `<form>` and check `document.querySelector('input[name="historicalRange"]')` in `handleSave`. `src/app/plans/[id]/page.tsx` must redirect unauthorized accesses to `/plans?error=...`, and `src/app/plans/page.tsx` must render the error toast and `#plans-dashboard-container`.

---

## 3. Caveats
- **No caveats.** All 20 test cases in `e2e/planner_tier1_feature.spec.ts` were fully traced against the application codebase. The recommended fixes rely entirely on standard React, Zustand, Next.js 16 Server Actions, and Zod patterns matching the existing architecture.

---

## 4. Conclusion
The codebase exhibits excellent architectural foundations but requires 9 precise surgical updates across frontend components, state hydration, Server Actions, and BOLA defenses to achieve 100% E2E test compliance. Implementing the detailed fix strategy outlined above will seamlessly align the application with all Tier 1 feature expectations.

---

## 5. Verification Method
The receiving Worker and Reviewer agents can independently verify the success of the changes using the following verification procedures:
1. Run the fully automated E2E test runner:
   ```bash
   npx tsx e2e/run_e2e.ts
   ```
   *(Note: Ensure `npx` / `node` is available in PATH or execute via the appropriate local Node environment wrapper).*
2. Verify absolute success (Exit Code `0`) across all 20 test cases in `e2e/planner_tier1_feature.spec.ts`.
3. Verify via `git status` that all changes exist strictly in the local working directory with zero commits pushed to remote repositories.
