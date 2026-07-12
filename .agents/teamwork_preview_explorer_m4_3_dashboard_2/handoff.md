# Handoff Report: Milestone 4.3 - Authenticated Dashboard & 7-Tab Builder

## Summary of Core Findings
An in-depth architectural investigation of the Milestone 4.3 requirements (`/plans` dashboard, `/plans/new`, `/plans/[id]`, `src/components/PlanBuilder.tsx`, and `__tests__/planner/planBuilder.spec.tsx`) reveals two critical discrepancies between the high-level task specifications and the underlying backend implementation: `savePlan` in `retirementActions.ts` expects a single `planData: unknown` object matching `HouseholdSchema` rather than two parameters `(id, { household, simulationConfig })`, and `savePlan` revalidates `/planner` instead of `/plans`. We have formulated a highly robust, zero-layout-shift implementation strategy that pre-hydrates Zustand state directly on the server for `/plans/new` and `/plans/[id]`, aligns client-server contracts perfectly, and outlines a rigorous unit testing blueprint to achieve 100% passing test coverage in Jest.

---

## 1. Observation

### 1.1 Existing Type & Schema Definitions (`src/lib/planner/types.ts`)
- **`HouseholdSchema` (lines 110-139)**: Defines the primary entity stored in `retirement_plans`. It contains optional fields `id` and `user_id`, mandatory fields (`name`, `taxJurisdiction`, `stateProvince`, `birthYear`, `retirementAge`), and embedded child entities (`accounts`, `spending`, `pensions`, `lifeEvents`, `simulationConfig`).
- **Refinement & Validation**: `HouseholdSchema` enforces strict refinement checks, such as verifying that `minWithdrawal <= maxWithdrawal` in `SpendingSchema` (line 38), and ensuring spouse-owned accounts/pensions are not present if `includeSpouse` is false and spouse birth/retirement ages are undefined (lines 128-135).

### 1.2 Server Actions & Security Policies (`src/app/actions/retirementActions.ts`)
- **`requirePremiumUser` (lines 7-29)**: Requires Supabase authentication and verifies `profiles.tier === 'premium'`. Throws `'Unauthorized'` or `'Premium tier required'`.
- **`getPlans()` (lines 31-59)**: Queries the `retirement_plans` table filtering by `user_id`. Returns `{ success: boolean; data?: Household[]; error?: string }`.
- **`getPlan(id: string)` (lines 61-91)**: Queries `retirement_plans` by `id` and `user_id` (BOLA defense). Returns `{ success: boolean; data?: Household; error?: string }`.
- **`savePlan(planData: unknown)` (lines 93-171)**:
  - **Signature**: Expects exactly one parameter (`planData: unknown`), contrary to the two-parameter signature `savePlan(id, { household, simulationConfig })` described in `task_description.md`.
  - **Validation**: Performs `HouseholdSchema.safeParse(planData)`. If `id` is present in the parsed object, it executes an `UPDATE` query matching `eq('id', id).eq('user_id', user.id)`. Otherwise, it executes an `INSERT`.
  - **Revalidation Paths**: Calls `revalidatePath('/planner', 'layout')` and `revalidatePath(`/planner/${id}`, 'page')` (lines 128-129, 154). Note that it does **not** call `revalidatePath('/plans')`.

### 1.3 Zustand Store Architecture (`src/store/useRetirementStore.tsx`)
- **`createRetirementStore` (lines 72-273)**: Creates a store managing `household`, `simulationConfig`, `activeTab` (default `'household'`), `simulationResults`, `isSimulating`, `activeWorker`, and `error`.
- **`hydrateFromParams` (lines 125-200)**: Parses either a `URLSearchParams` instance or a plain dictionary object `{ [key: string]: string }`, updating `household.accounts`, `household.spending`, `household.taxJurisdiction`, and `household.simulationConfig`.
- **`RetirementStoreProvider` (lines 301-317)**: A React context provider accepting `initialData?: Partial<RetirementState>`. It initializes the store with `initialData` and rehydrates if `initialData` changes across renders.
- **Web Worker Fallback (lines 202-272)**: `runSimulation()` seamlessly falls back to direct execution via `handleSimulationMessage` if `window.Worker` is undefined or throws an error.

### 1.4 Route & Component Directory Status
- **`src/app`**: Contains `(auth)`, `(dashboard)`, `actions`, `api`, `auth`, `education`, `globals.css`, `layout.tsx`, `page.tsx`. There is no `plans` directory.
- **`src/app/(dashboard)`**: Contains `admin`, `budget`, `dashboard`, `deals`, `settings`. There is no `layout.tsx` inside `(dashboard)`, meaning `src/app/layout.tsx` is the primary global layout.
- **`src/components`**: Contains `QuickCheckWidget.tsx` and various dashboard components, but `PlanBuilder.tsx` does not exist.
- **`__tests__/planner`**: Contains extensive unit tests (`useRetirementStore.spec.ts`, `quickCheckWidget.spec.tsx`, etc.), but `planBuilder.spec.tsx` does not exist.

---

## 2. Logic Chain

### 2.1 Resolving the `savePlan` Contract Discrepancy
1. **Observation**: `task_description.md` specifies calling `savePlan(id, { household, simulationConfig })`. However, `retirementActions.ts` defines `savePlan(planData: unknown)` and validates `planData` directly against `HouseholdSchema`.
2. **Inference**: Calling `savePlan` with two arguments will pass `id` as `planData` and ignore the second argument. `HouseholdSchema.safeParse(id)` will fail, resulting in `{ success: false, error: 'Invalid retirement plan data structure' }`.
3. **Conclusion & Blueprint**: In `PlanBuilder.tsx`, the "Save Plan" handler must merge `household`, `simulationConfig`, and `id` into a single object before invoking `savePlan`:
   ```typescript
   const planPayload = {
     ...household,
     id: props.id || household.id,
     simulationConfig: simulationConfig
   };
   const result = await savePlan(planPayload);
   ```

### 2.2 Resolving the Revalidation Route Discrepancy
1. **Observation**: `savePlan` calls `revalidatePath('/planner', 'layout')` instead of `revalidatePath('/plans')`.
2. **Inference**: When a user saves a plan in `/plans/[id]` or `/plans/new` and navigates back to `/plans`, Next.js might serve a stale client router cache if `/plans` is not explicitly refreshed.
3. **Conclusion & Blueprint**: After a successful `savePlan`, the client component `PlanBuilder` must explicitly invoke `router.refresh()` and `router.push('/plans')` to ensure the dashboard reflects the newly saved or updated plan.

### 2.3 Eliminating Client-Side Layout Shifts in `/plans/new`
1. **Observation**: `task_description.md` allows either passing `initialData` derived from `searchParams` to `RetirementStoreProvider` OR mounting a client wrapper that invokes `hydrateFromParams`.
2. **Inference**: Invoking `hydrateFromParams` on mount in a client useEffect causes an initial render with default state followed by a re-render with hydrated state. This violates optimal UX and introduces unnecessary layout shifts.
3. **Conclusion & Blueprint**: Since `createRetirementStore` is fully decoupled from browser APIs, `/plans/new/page.tsx` (a Server Component) can instantiate a temporary store instance, invoke `hydrateFromParams(searchParams)`, and pass the pre-hydrated state directly to `RetirementStoreProvider`. This achieves perfect server-side rendering with zero client layout shifts:
   ```tsx
   import React from 'react';
   import { RetirementStoreProvider, createRetirementStore } from '@/store/useRetirementStore';
   import PlanBuilder from '@/components/PlanBuilder';

   export default function NewPlanPage({ searchParams }: { searchParams: { [key: string]: string | undefined } }) {
     const tempStore = createRetirementStore();
     tempStore.getState().hydrateFromParams(searchParams);
     const initialData = {
       household: tempStore.getState().household,
       simulationConfig: tempStore.getState().simulationConfig,
     };

     return (
       <RetirementStoreProvider initialData={initialData}>
         <PlanBuilder />
       </RetirementStoreProvider>
     );
   }
   ```

### 2.4 Designing the 7-Tab Plan Builder SPA (`src/components/PlanBuilder.tsx`)
1. **Observation**: `useRetirementStore()` provides full getter/setter access for `household`, `simulationConfig`, `activeTab`, `simulationResults`, `isSimulating`, `error`, `setActiveTab`, `updateHousehold`, `updateSimulationConfig`, and `runSimulation`.
2. **Inference**: `PlanBuilder` must act as the view controller, rendering a tab navigation bar and switching between 7 specialized form/display views based on `activeTab`.
3. **Conclusion & Blueprint**:
   - **Tab Navigation**: Render 7 buttons (`Household`, `Accounts`, `Spending`, `Pensions`, `Life Events`, `Simulation`, `Summary`). Clicking calls `setActiveTab(tab)`.
   - **Tab 1 (Household)**: Form inputs for `name`, `taxJurisdiction`, `stateProvince`, `birthYear`, `retirementAge`, `includeSpouse`, `spouseBirthYear`, `spouseRetirementAge`. Updates trigger `updateHousehold`.
   - **Tab 2 (Accounts)**: Lists `household.accounts`. Form to add/modify accounts (`id`, `name`, `type`, `balance`, `costBasis`, `owner`). Updates trigger `updateHousehold({ accounts })`.
   - **Tab 3 (Spending)**: Form inputs for `initialBase`, `strategy`, `minWithdrawal`, `maxWithdrawal`, `yaleWeight`, `inflationAdjusted`. Updates trigger `updateHousehold({ spending })`.
   - **Tab 4 (Pensions)**: Lists `household.pensions`. Form to add/modify pensions (`id`, `owner`, `type`, `baseAmount`, `startAge`, `inflationAdjusted`). Updates trigger `updateHousehold({ pensions })`.
   - **Tab 5 (Life Events)**: Lists `household.lifeEvents`. Form to add/modify life events (`id`, `name`, `age`, `startYear`, `endYear`, `type`, `amount`, `inflationAdjusted`). Updates trigger `updateHousehold({ lifeEvents })`.
   - **Tab 6 (Simulation)**: Inputs for `simulationConfig` (`drawdownStrategy`, `historicalRange`, `numPaths`, `inflationRate`, `retirementHorizon`). Includes the **Premium Range Selector** (20 yr, 50 yr, 125 yr) with simulated/actual check for Premium Tier Lock card. Action button calling `runSimulation()`. Displays loading spinner when `isSimulating` is true, or error banner if `error` is present.
   - **Tab 7 (Summary)**: Displays `simulationResults` (`successRate`, `medianFinalBalance`, `tenthPercentileFinalBalance`, `ninetiethPercentileFinalBalance`, and annual ending balances table/chart).
   - **Header & Save Button**: Render plan title and a "Save Plan" button using `useTransition`. On click, invokes `savePlan`, followed by `router.refresh()` and `router.push('/plans')`. Displays success/error status alerts.

### 2.5 Designing the Authenticated Dashboard (`src/app/plans/page.tsx`)
1. **Observation**: `getPlans()` returns `{ success, data: Household[], error }`.
2. **Inference**: The dashboard must gracefully handle error states (e.g. `'Premium tier required'`, `'Unauthorized'`) and render an elegant list of plans when `success` is true.
3. **Conclusion & Blueprint**:
   - Fetch plans: `const { success, data: plans, error } = await getPlans();`.
   - If `error === 'Premium tier required'`, render an An-yen frosted glass Premium Lock card informing the user that retirement planning is a premium feature.
   - If `error === 'Unauthorized'`, render an authentication required notice or redirect to login.
   - If `success` and `plans`: Render a grid of plan cards showing Plan Name (`plan.name`), Primary Portfolio Balance (`plan.accounts[0].balance`), Retirement Horizon (`plan.simulationConfig.retirementHorizon`), and Simulation Status ("Configured" / "Ready to Simulate").
   - Include action buttons: `<Link href="/plans/new">` (Create New Plan) and `<Link href={`/plans/${plan.id}`}>` (View Plan).

### 2.6 Designing the Detailed Plan Route (`src/app/plans/[id]/page.tsx`)
1. **Observation**: `getPlan(params.id)` returns `{ success, data: Household, error }`.
2. **Inference**: Must handle 404s/unauthorized and initialize `RetirementStoreProvider`.
3. **Conclusion & Blueprint**:
   - Fetch plan: `const { success, data: plan, error } = await getPlan(params.id);`.
   - If `!success` or `!plan`: Invoke `notFound()` from `next/navigation` or redirect to `/plans`.
   - On success: Extract `plan.simulationConfig` and pass `initialData = { household: plan, simulationConfig: plan.simulationConfig || defaultSimulationConfig }` to `RetirementStoreProvider`, wrapping `<PlanBuilder id={params.id} />`.

---

## 3. Caveats

1. **`savePlan` Parameter Signature Mismatch**: As analyzed in Section 2.1, `task_description.md` specifies `savePlan(id, { household, simulationConfig })`, but `retirementActions.ts` expects `savePlan(planData: unknown)`. The implementer **must** adhere to the single `planData` object signature to prevent runtime schema validation failures.
2. **Revalidation Target Mismatch**: `savePlan` revalidates `/planner` rather than `/plans`. The implementer must include `router.refresh()` in the client component after saving to ensure the dashboard displays updated data.
3. **Next.js `searchParams` / `params` Unwrapping**: In Next.js 15+, `searchParams` and `params` in page components are treated as Promises in some contexts, but in standard Next.js 14 and earlier they are plain objects. The implementer should verify whether `await searchParams` is required by their specific Next.js compiler version (referencing `AGENTS.md` "This is NOT the Next.js you know"). For maximum compatibility in Next.js 14/15 hybrid setups, accessing `searchParams` directly as an object or destructuring it in the function signature is standard, but if warnings arise, wrapping in `use()` or `await` may be needed.
4. **Zod Schema Cross-Field Validations**: `HouseholdSchema` enforces strict cross-field validations (e.g. spouse accounts cannot exist without spouse properties; `minWithdrawal <= maxWithdrawal`). The `PlanBuilder` form UI must ensure it does not submit invalid combinations to `savePlan`, or handle the resulting server action error gracefully.

---

## 4. Conclusion

The Milestone 4.3 feature set can be implemented with outstanding architectural integrity, complete security adherence, and zero client-side layout shifts by following these structured steps:

1. **Create `src/app/plans/page.tsx`**: Implement the Server Component dashboard calling `getPlans()`. Render An-yen premium lock cards on entitlement failures, and an elegant grid of existing plans with navigation links to `/plans/new` and `/plans/[id]`.
2. **Create `src/app/plans/new/page.tsx`**: Implement the Server Component route receiving `searchParams`. Pre-hydrate `initialData` on the server using a standalone `createRetirementStore()` instance, wrapping `PlanBuilder` in `RetirementStoreProvider`.
3. **Create `src/app/plans/[id]/page.tsx`**: Implement the Server Component route calling `getPlan(params.id)`. Handle 404/redirects cleanly, and pass fetched `plan` data as `initialData` to `RetirementStoreProvider`.
4. **Create `src/components/PlanBuilder.tsx`**: Implement the 7-Tab Client Component SPA utilizing `useRetirementStore()`. Render tab navigation, dedicated form views for `Household`, `Accounts`, `Spending`, `Pensions`, `Life Events`, `Simulation` (with Premium Range Selector), and `Summary`. Implement the `savePlan({ ...household, simulationConfig, id })` handler with `useTransition` and `router.refresh()`.
5. **Create `__tests__/planner/planBuilder.spec.tsx`**: Implement a comprehensive Jest unit test suite covering 100% of the newly created components and routes.

---

## 5. Verification Method

To independently verify the correctness, test coverage, and acceptance criteria of the implementation, execute the following specific commands:

### 5.1 Unit Testing & Coverage Verification
Run the Jest test suite specifically targeting the planner tests to ensure 100% passing unit tests across all 7 tabs, store hydration, and server action interactions:
```bash
npm run test __tests__/planner
```
*Expected Output*: `PASS __tests__/planner/planBuilder.spec.tsx` along with existing tests, showing 100% success rate with zero failing test cases.

### 5.2 End-to-End & Accessibility Verification
Run the Playwright E2E integration test suite to verify Dual Entry state handoff, Premium Lock validation, and automated `@axe-core/playwright` accessibility audits:
```bash
npx tsx e2e/run_e2e.ts
```
*Expected Output*: Successful execution of all E2E test paths with zero WCAG 2.1 AA/AAA accessibility violations.

### 5.3 Git Integrity Verification
Verify that all changes remain strictly in the local working directory with zero commits pushed to remote git repositories:
```bash
git status
```
*Expected Output*: Untracked or modified files listed in `src/app/plans`, `src/components/PlanBuilder.tsx`, and `__tests__/planner/planBuilder.spec.tsx`, with `Your branch is up to date with 'origin/main'` and zero commits ahead.

### 5.4 Invalidation Conditions
The verification is considered failed if:
- `npm run test` reports any failing test or unhandled promise rejection in `planBuilder.spec.tsx`.
- `savePlan` throws a 500 error or returns `Invalid retirement plan data structure` due to incorrect argument passing.
- `git status` reveals changes pushed to a remote repository or files created outside the designated workspace directories.
