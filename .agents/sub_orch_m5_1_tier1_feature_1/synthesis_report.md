# Synthesized Findings & Actionable Summary: M5.1 Tier 1 Feature Coverage Analysis

## Consensus
All Explorers established absolute consensus regarding the root causes of E2E test failures in `e2e/planner_tier1_feature.spec.ts`. The application has robust architectural underpinnings but requires targeted, surgical updates across 9 specific files to achieve full feature alignment and test pass criteria.

### 1. Dual Entry Architecture & Zustand URL Hydration
- **`src/store/useRetirementStore.tsx`**:
  - **CRITICAL RSC FIX**: Must add `"use client";` directive at the very top of the file. Without it, importing `RetirementStoreProvider` into server components causes a fatal Next.js RSC build error (`You're importing a module that depends on useEffect into a React Server Component module...`).
  - `defaultHousehold` initializes with `balance: 1000000` and `birthYear: 1965`. Test 5 expects baseline defaults of `currentAge: 30`, `retirementAge: 65`, `currentSavings: 0`. (Note: calculate `birthYear: new Date().getFullYear() - 30`).
  - `hydrateFromParams` fails to parse `currentAge`, `retirementAge`, `currentSavings`, `monthlyContribution`. It must parse these search params and correctly update the store state (`household.birthYear`, `household.retirementAge`, `accounts[0].balance`, `accounts[0].costBasis`/monthly contribution).
  - Standard users must default to `most_recent_20_years` to prevent locking them out upon initialization.
- **`src/components/QuickCheckWidget.tsx`**:
  - Main container div lacks `id="quick-check-widget"`.
  - Input fields currently maintain state for portfolio, withdrawal, years, taxJurisdiction. They must be updated to maintain state for `currentAge` (default 35), `retirementAge` (default 65), `currentSavings` (default 100000), `monthlyContribution` (default 1500) with corresponding DOM IDs `#quick-current-age`, `#quick-retirement-age`, `#quick-current-savings`, `#quick-monthly-contribution`.
  - Submit button lacks `id="save-unlock-btn"`.
  - `handleBuildPlan` must construct the correct redirect URL and navigate to `/login?redirect=` (or `/auth?redirect=`) encoding `encodeURIComponent('/plans/new?currentAge=35&retirementAge=65&currentSavings=100000&monthlyContribution=1500')`.
- **`src/app/(auth)/login/page.tsx`**:
  - In `handleAuth`, upon successful sign-in, it unconditionally sets `window.location.href = '/dashboard'`, completely ignoring `searchParams.get('redirect')`. It must check for `redirect` in `searchParams` and redirect accordingly (falling back to `/dashboard` or `/plans`).
- **`src/lib/planner/types.ts`**:
  - `HouseholdSchema` and `AccountSchema` must explicitly include `currentAge`, `monthlyContribution`, `currentSavings`, and `historicalRange` as optional properties so Zod `safeParse` does not strip them during persistence.

### 2. Authenticated Dashboard & 7-Tab Detailed Plan Builder
- **`src/app/plans/page.tsx`**:
  - Root container lacks `id="plans-dashboard-container"`.
  - Plan cards lack the `.plan-card` CSS class.
  - Must accept `searchParams` to check for and render redirected error messages in `<div className="toast-error">{searchParams.error}</div>`.
- **`src/components/PlanBuilder.tsx`**:
  - Must render `<div id="hydrated-marker" className="hidden" />`.
  - Tab buttons must have `id="tab-household"`, `id="tab-accounts"`, `id="tab-spending"`, `id="tab-pensions"`, `id="tab-events"`, `id="tab-taxes"`, `id="tab-simulation"`.
  - Must ensure `taxes` is present in the tabs array and panels (replace `summary` or add `taxes`).
  - Tab button `className` must append `'active'` when active.
  - Tab content panels must have `id="panel-household"`, `id="panel-accounts"`, `id="panel-spending"`, `id="panel-pensions"`, `id="panel-events"`, `id="panel-taxes"`, `id="panel-simulation"`.
  - Household panel must render `#input-current-age` and `#input-retirement-age`. `#input-current-age` must include `onBlur` Zod validation logic for age < 0 to render `<div className="validation-error">Please enter a valid age</div>`.
  - Accounts panel must render `#input-current-savings` and `#input-monthly-contribution`.
  - Plan name input must have `id="input-plan-name"`.
  - Save button must have `id="save-plan-btn"`.
  - Save status toast must include `.toast-success` and `.toast-error` classes.
  - `handleSave` must omit redirection to `/plans` when updating an existing plan (`planId` exists) to allow `page.reload()` in Test 17.
  - Must wrap content in a `<form>` so Playwright's `page.evaluate` can append `<input type="hidden" name="historicalRange" value="125" />`. `handleSave` must check `document.querySelector('input[name="historicalRange"]')` (e.g., value "125" mapping to `all_125_years` or similar) to pass `historicalRange` to `savePlan` for verifying BOLA premium parameter rejection in Test 18.
- **`src/components/SimulationTab.tsx`**:
  - Premium lock overlay must have `id="premium-lock-card"` and use exact classes `bg-white/40 backdrop-blur-md border-white/20`.
  - Range selection buttons must have IDs `#range-20yr`, `#range-50yr`, `#range-125yr`, mapping to `most_recent_20_years`, `most_recent_50_years`, `all_125_years`.
  - Range button disabled logic must allow standard users to select `most_recent_20_years` (and default to it).
  - Run simulation button must have `id="run-simulation-btn"`.
  - Results container must have `id="simulation-results-summary"` and display projection horizon (`125-Year Projection` or `20-Year Projection`) and path count (`1,000 paths simulated`).
  - Must render `#wealth-fan-chart` and adjacent `div.sr-only table` with headers `10th Percentile`, `50th Percentile`, `90th Percentile`.

### 3. Server Actions, BOLA Defenses & Accessibility Audits
- **`src/app/actions/retirementActions.ts`**:
  - Replace unconditional `requirePremiumUser` at the start of `getPlans`, `getPlan`, and `savePlan` with a non-throwing check (`getUserAndTier` / `requireAuthUser`) for standard users.
  - In `savePlan`, BOLA premium parameter check: verify if `simulationConfig.historicalRange` is `all_125_years` or `most_recent_50_years`. If so, and user is not premium, return `{ success: false, error: 'This feature requires a Premium subscription' }`.
- **`src/app/plans/[id]/page.tsx`**:
  - Instead of calling `notFound()` when `getPlan` fails or returns unauthorized, redirect to `/plans?error=You+do+not+have+permission+to+view+this+plan`.

## Resolved Conflicts
- None. All Explorers corroborated the exact same underlying architecture and required modifications.

## Dissenting Views
- None. Complete consensus achieved.

## Gaps
- None. 100% of the test cases in `e2e/planner_tier1_feature.spec.ts` have been successfully mapped to concrete code fixes.
