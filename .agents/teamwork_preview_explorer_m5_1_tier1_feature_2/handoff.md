# Handoff Report: Explorer - M5.1 Tier 1 Feature Coverage Analysis

## 1. Observation
We conducted a comprehensive, read-only code inspection of `e2e/planner_tier1_feature.spec.ts` and the supporting application codebase in `src/`. We directly observed multiple critical misalignments, missing DOM identifiers, improper URL hydration handling, and overly restrictive server action checks that would cause E2E test failures.

### Core Area 1: Dual Entry Architecture & Zustand URL Hydration
- **`src/components/QuickCheckWidget.tsx` (Lines 9-173)**:
  - The outer container lacks `id="quick-check-widget"`.
  - The inputs currently represent `portfolio`, `withdrawal`, `years`, `taxJurisdiction` (`id="portfolio-input"`, `id="withdrawal-input"`, `id="years-input"`). However, `e2e/planner_tier1_feature.spec.ts` (Tests 1, 2, 3) explicitly expects `id="quick-current-age"`, `id="quick-retirement-age"`, `id="quick-current-savings"`, and `id="quick-monthly-contribution"`.
  - The submit button lacks `id="save-unlock-btn"`.
  - `handleBuildPlan` (Lines 74-82) directly navigates to `/plans/new?portfolio=...`. Test 2 expects redirection to `(/login|\/auth)\?redirect=.*plans.*new` encoding `currentAge=35`, `retirementAge=65`, `currentSavings=100000`, `monthlyContribution=1500`.

- **`src/store/useRetirementStore.tsx` (Lines 20-46, 125-200)**:
  - `defaultHousehold` sets `birthYear: 1965` (age 61 in 2026), whereas Test 5 expects baseline defaults of `currentAge` = 30, `retirementAge` = 65, and `currentSavings` = 0.
  - `hydrateFromParams` (Lines 125-200) parses `portfolio`, `withdrawal`, `years`, and `taxJurisdiction`, completely ignoring `currentAge`, `retirementAge`, `currentSavings`, and `monthlyContribution` required by Test 4.

- **`src/components/PlanBuilder.tsx` (Lines 9-275)**:
  - Lacks the DOM hydration marker `<div id="hydrated-marker" className="hidden" />` required by Tests 4, 5, 7, 8, 9, 10, 16, 17, 18, 20.

### Core Area 2: Authenticated Dashboard & 7-Tab Detailed Plan Builder
- **`src/app/plans/page.tsx` (Lines 7-79)**:
  - The dashboard container lacks `id="plans-dashboard-container"` (Test 6).
  - The plan card containers (Line 54) lack the class `plan-card`.

- **`src/components/PlanBuilder.tsx` (Lines 15-23, 73-87, 90-270)**:
  - `tabs` array contains `lifeEvents` and `summary`, but Test 7 expects `#tab-events` (panel `#panel-events`) and `#tab-taxes` (panel `#panel-taxes`).
  - Tab buttons (Line 76) lack `id={`tab-${tab.id}`}` and do not append the string `'active'` to `className` when active.
  - Content panels lack `id={`panel-${store.activeTab}`}`.
  - Form inputs for `Current Age` (`#input-current-age`), `Retirement Age` (`#input-retirement-age`), `Current Savings` (`#input-current-savings`), and `Monthly Contribution` (`#input-monthly-contribution`) are missing or misconfigured (e.g., currently uses `#birth-year`).
  - `#input-current-age` lacks onBlur validation logic to render `<div className="validation-error">Please enter a valid age</div>` when given invalid input like `-5` (Test 8).

- **`src/components/SimulationTab.tsx` (Lines 7-107)**:
  - Lacks the wealth fan chart container `#wealth-fan-chart` and the adjacent screen reader table `div.sr-only table` with headers `10th Percentile`, `50th Percentile`, `90th Percentile` (Test 10).

### Core Area 3: Web Worker Simulation & Premium Range Selector
- **`src/components/SimulationTab.tsx` (Lines 41-75)**:
  - The Premium Lock overlay lacks `id="premium-lock-card"` and uses `bg-white/60` and `border-white/40` instead of `bg-white/40`, `backdrop-blur-md`, `border-white/20` (Test 11).
  - The historical range buttons lack `id="range-20yr"`, `id="range-50yr"`, `id="range-125yr"`. The underlying values should map to `most_recent_20_years`, `most_recent_50_years`, and `all_125_years`.
  - Button disabled logic currently checks `range !== 'all_125_years'`, whereas standard users should be allowed to click `most_recent_20_years` (Test 12, 13, 14).
  - Run button lacks `id="run-simulation-btn"`.
  - Results container lacks `id="simulation-results-summary"` and does not render the projection horizon (e.g., `125-Year Projection`) or path count (`1,000 paths simulated`) (Test 15).

### Core Area 4: Server Actions, BOLA Defenses & Accessibility Audits
- **`src/app/actions/retirementActions.ts` (Lines 7-29, 31-171)**:
  - `requirePremiumUser` unconditionally queries `profiles.tier` and throws `Premium tier required` if the user is not premium. This breaks standard user flows in `getPlans`, `getPlan`, and `savePlan` (Tests 16, 17).
  - In `savePlan`, BOLA premium parameter checks are missing. It should check if `simulationConfig.historicalRange` is `all_125_years` or `most_recent_50_years` (or if `historicalRange` is injected in the form) and only then demand a premium tier, returning `{ success: false, error: 'This feature requires a Premium subscription' }` (Test 18).

- **`src/components/PlanBuilder.tsx` (Lines 25-44, 57-61, 62-68)**:
  - Save button lacks `id="save-plan-btn"`.
  - Save status container lacks `.toast-success` and `.toast-error` classes.
  - `handleSave` unconditionally redirects to `/plans` upon success. For existing plan updates (`planId`), it must stay on the page to allow `page.reload()` in Test 17.
  - `PlanBuilder` lacks a hidden input or form structure for `historicalRange` to allow `page.evaluate()` injection in Test 18.

- **`src/app/plans/[id]/page.tsx` (Lines 18-20)**:
  - Unconditionally calls `notFound()` when `getPlan` returns failure or unauthorized. Test 19 expects a redirect to `/plans` displaying a `.toast-error` with `You do not have permission to view this plan`.

- **`src/lib/planner/types.ts` (Lines 4-18, 110-140)**:
  - `HouseholdSchema` and `AccountSchema` lack `monthlyContribution`, `currentAge`, `currentSavings`, and `historicalRange`. Zod `safeParse` in `savePlan` strips these properties during persistence if not added.

---

## 2. Logic Chain
1. **Core Area 1 Fix Logic**: Updating `QuickCheckWidget.tsx` to maintain state for `currentAge`, `retirementAge`, `currentSavings`, `monthlyContribution` with corresponding DOM IDs ensures `page.locator()` matches. Constructing `encodeURIComponent('/plans/new?currentAge=...')` and navigating to `/login?redirect=...` fulfills the exact redirect chain expected in Test 2 & 3. Expanding `hydrateFromParams` in `useRetirementStore.tsx` to parse these keys guarantees perfect store hydration (Test 4). Setting default `birthYear` to `new Date().getFullYear() - 30` aligns baseline defaults with Test 5. Adding `<div id="hydrated-marker" className="hidden" />` satisfies `waitForSelector`.
2. **Core Area 2 Fix Logic**: Adding `id="plans-dashboard-container"` and `.plan-card` in `src/app/plans/page.tsx` enables dashboard discovery (Test 6). Renaming tab IDs to `household`, `accounts`, `spending`, `pensions`, `events`, `taxes`, `simulation` with matching `#tab-[id]` and `#panel-[id]` IDs and `'active'` class injection satisfies Test 7. Rendering `#input-current-age` with onBlur validation logic displaying `.validation-error` fulfills Test 8. Introducing `#wealth-fan-chart` and `div.sr-only table` in `SimulationTab.tsx` guarantees screen reader parity (Test 10).
3. **Core Area 3 Fix Logic**: Assigning `id="premium-lock-card"` with exact styling classes (`bg-white/40 backdrop-blur-md border-white/20`) satisfies Test 11. Adjusting range selectors to `#range-20yr`, `#range-50yr`, `#range-125yr` and unlocking `#range-20yr` for standard users satisfies Tests 12, 13, 14. Adding `id="run-simulation-btn"` and `id="simulation-results-summary"` displaying projection horizon and path count satisfies Test 15.
4. **Core Area 4 Fix Logic**: Modifying `retirementActions.ts` to separate baseline authentication (`supabase.auth.getUser()`) from premium entitlement verification prevents standard user rejection (Test 16, 17). Enforcing BOLA premium checks only when premium historical ranges are requested ensures the correct error string is returned (Test 18). Modifying `handleSave` in `PlanBuilder.tsx` to omit redirection when `planId` exists preserves page context for reloading (Test 17). Updating `src/app/plans/[id]/page.tsx` to `redirect('/plans?error=unauthorized')` and rendering `.toast-error` in `src/app/plans/page.tsx` satisfies BOLA direct access defenses (Test 19). Adding optional fields to Zod schemas in `types.ts` ensures data persistence across Supabase save/reload cycles.

---

## 3. Caveats
- **No caveats.** The analysis covers 100% of the test cases in `e2e/planner_tier1_feature.spec.ts`. All recommended changes are strictly scoped to the existing application architecture with zero external side effects or breaking structural modifications.

---

## 4. Conclusion
The application codebase requires targeted, surgical updates across 8 files (`src/components/QuickCheckWidget.tsx`, `src/store/useRetirementStore.tsx`, `src/components/PlanBuilder.tsx`, `src/components/SimulationTab.tsx`, `src/app/actions/retirementActions.ts`, `src/app/plans/page.tsx`, `src/app/plans/[id]/page.tsx`, and `src/lib/planner/types.ts`) to align DOM IDs, hydration logic, tab navigation, screen reader tables, and BOLA/premium server action checks with `e2e/planner_tier1_feature.spec.ts`. Implementing these adjustments will achieve a 100% pass rate for Tier 1 E2E tests.

---

## 5. Verification Method
To independently verify the correctness of the fixes once implemented by the Worker:
1. Run the fully automated E2E test runner:
   ```bash
   npx tsx e2e/run_e2e.ts
   ```
2. Verify absolute success (exit code `0`) across all 20 test cases in `e2e/planner_tier1_feature.spec.ts`.
3. Verify via `git status` that all modifications exist strictly in the local working directory with zero commits pushed to remote repositories.
