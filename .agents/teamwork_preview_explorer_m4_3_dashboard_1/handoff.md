# Handoff Report: Milestone 4.3 (Authenticated Dashboard & 7-Tab Builder)

## 1. Observation
During our read-only investigation of the existing codebase and milestone requirements, we directly observed the following structural contracts, dependencies, and files:
- **Target Files Status**: Via `list_dir` on `src/app`, `src/components`, and `__tests__/planner`, we confirmed that `src/app/plans/page.tsx`, `src/app/plans/new/page.tsx`, `src/app/plans/[id]/page.tsx`, `src/components/PlanBuilder.tsx`, and `__tests__/planner/planBuilder.spec.tsx` do not currently exist and must be created from scratch in M4.3.
- **Next.js Breaking Changes**: Upon inspecting `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` (lines 8-18, 38-66, 67-121), we directly observed that in Next.js 15, `params` and `searchParams` are passed to page components as **Promises**. Specifically:
  ```tsx
  export default async function Page({
    params,
    searchParams,
  }: {
    params: Promise<{ slug: string }>
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
  }) {
    const { slug } = await params
    const filters = (await searchParams).filters
  }
  ```
- **Server Action Contracts (`src/app/actions/retirementActions.ts`)**:
  - `getPlans()` (lines 31-59) returns `Promise<{ success: boolean; data?: Household[]; error?: string }>`. It enforces Premium tier and user session checks, returning errors like `'Premium tier required'` or `'Unauthorized'`.
  - `getPlan(id: string)` (lines 61-91) returns `Promise<{ success: boolean; data?: Household; error?: string }>`.
  - `savePlan(planData: unknown)` (lines 93-171) validates incoming data via `HouseholdSchema.safeParse(planData)`. If successful, it extracts `id` and `user_id` and performs either an `UPDATE` or `INSERT` on `retirement_plans`.
- **Domain Schema Contracts (`src/lib/planner/types.ts`)**:
  - `HouseholdSchema` (lines 110-139) represents the top-level entity stored in the database. It contains fields such as `name`, `taxJurisdiction`, `birthYear`, `retirementAge`, `accounts`, `spending`, `pensions`, `lifeEvents`, and notably includes `simulationConfig: SimulationConfigSchema.optional()`.
- **Zustand Store Contracts (`src/store/useRetirementStore.tsx`)**:
  - `RetirementStoreProvider` (lines 301-317) accepts `initialData?: Partial<RetirementState>`.
  - `useRetirementStore` (lines 321-327) provides access to the state and actions like `setHousehold`, `updateHousehold`, `updateSimulationConfig`, `setActiveTab`, `runSimulation`, and `hydrateFromParams`.
- **UI Design & Testing Patterns**:
  - `src/components/QuickCheckWidget.tsx` demonstrates An-yen UI styling using Tailwind classes such as `bg-white/80 backdrop-blur-md border border-white/40 rounded-3xl shadow-xl text-zen-charcoal`.
  - `__tests__/planner/quickCheckWidget.spec.tsx` demonstrates testing components using Jest, `@testing-library/react`, `act`, and mocking `next/navigation` (`useRouter`).

---

## 2. Logic Chain
1. **Next.js 15 Page Props Asynchrony**: Because `params` and `searchParams` are Promises in Next.js 15, `src/app/plans/new/page.tsx` and `src/app/plans/[id]/page.tsx` must be `async` Server Components that explicitly await `searchParams` and `params` before utilizing their properties.
2. **Dashboard Data Fetching & Error Handling**: In `src/app/plans/page.tsx`, the Server Component must call `await getPlans()`. Since `getPlans()` can return `{ success: false, error: '...' }`, the UI must gracefully handle unauthorized/premium errors as well as empty states (`data.length === 0`). For valid plans, it must render cards showing `plan.name`, primary portfolio balance (`plan.accounts?.[0]?.balance ?? 0`), retirement horizon (`plan.simulationConfig?.retirementHorizon ?? 30`), and action buttons/links to `/plans/${plan.id}` and `/plans/new`.
3. **Plan Initialization (`/plans/new`) Hydration**: `src/app/plans/new/page.tsx` receives query parameters (`portfolio`, `withdrawal`, `years`, `taxJurisdiction`). To pass these cleanly to `PlanBuilder` and ensure full consistency with `useRetirementStore`, the page should either parse the params server-side to construct `initialData` for `RetirementStoreProvider`, or provide a clean client-side wrapper that calls `store.hydrateFromParams(searchParams)` on mount. A client wrapper component (e.g., `PlanBuilderClientWrapper`) ensures 100% reuse of the store's built-in hydration logic without duplicating parsing quirks.
4. **Detailed Plan Builder (`/plans/[id]`) Hydration & 404 Handling**: `src/app/plans/[id]/page.tsx` must await `params`, call `await getPlan(id)`, and if `!res.success || !res.data`, invoke `notFound()` or redirect to `/plans`. If successful, it wraps `PlanBuilder` in `<RetirementStoreProvider initialData={{ household: res.data, simulationConfig: res.data.simulationConfig || defaultSimulationConfig }}>`.
5. **`savePlan` Data Structure Alignment**: In `PlanBuilder.tsx`, when the user clicks "Save Plan", the client component must assemble the payload for `savePlan(planData)`. Because `HouseholdSchema.safeParse(planData)` expects a single top-level `Household` object, `PlanBuilder` must merge `household` and `simulationConfig` into a single object: `const payload = { ...household, id: planId || household.id, simulationConfig };`. Passing `{ household, simulationConfig }` would fail validation.
6. **7-Tab Component Architecture**: `PlanBuilder.tsx` must maintain the `activeTab` state (Household, Accounts, Spending, Pensions, Life Events, Simulation, Summary) via `useRetirementStore()`. Each tab view must provide form controls to modify the store state (e.g. `updateHousehold`, `updateSimulationConfig`) adhering to Zod validation constraints (e.g., `vanguard_dynamic` requiring `minWithdrawal <= maxWithdrawal`).
7. **Comprehensive Unit Testing**: `__tests__/planner/planBuilder.spec.tsx` must mock `next/navigation` (`useRouter`, `useParams`, `useSearchParams`) and `@/app/actions/retirementActions` (`savePlan`, `getPlans`, `getPlan`). The test suite must verify rendering of all 7 tabs, simulated user navigation between tabs, form input updates across the tabs, and triggering the `savePlan` action with optimistic UI state verification to achieve 100% test coverage.

---

## 3. Caveats
- **Read-Only Explorer Constraint**: As an Explorer agent, we have not directly implemented the files or run the test suite against the new components. The implementer must create these files and run `npm run test __tests__/planner` to ensure complete correctness.
- **Next.js Server Actions Mocking in Jest**: When testing Server Components or Server Actions in Jest, Next.js server-side modules (`next/headers`, `next/cache`, `@/utils/supabase/server`, `@/app/actions/retirementActions`) must be properly mocked at the top of the test file to avoid runtime exceptions in the JSDOM environment.
- **Simulation Tab Premium Feature Boundary**: As defined in `SCOPE.md`, the Premium Tier Historical Range Selector (20/50/125 yr) and An-yen frosted glass Premium Lock card are slated for Milestone 4.4. For Milestone 4.3, `PlanBuilder.tsx` should implement a clean, baseline Simulation tab view allowing users to configure basic simulation parameters and trigger `runSimulation()`.

---

## 4. Conclusion
We recommend the following precise implementation blueprint for Milestone 4.3:

1. **Create `src/app/plans/page.tsx`**:
   - `async` Server Component calling `getPlans()`.
   - Implement elegant error states (Premium required / Unauthorized), an empty state with a "Create Your First Plan" button, and a responsive grid of plan cards showing name, primary balance, horizon, and simulation status.

2. **Create `src/app/plans/new/page.tsx`**:
   - `async` Server Component awaiting `searchParams`.
   - Implement a client wrapper `PlanBuilderClientWrapper` that accepts `searchParams` as props, wraps `PlanBuilder` in `RetirementStoreProvider`, and uses `useLayoutEffect`/`useEffect` to call `store.hydrateFromParams(searchParams)`.

3. **Create `src/app/plans/[id]/page.tsx`**:
   - `async` Server Component awaiting `params`.
   - Call `getPlan(id)`. If unsuccessful, call `notFound()` or `redirect('/plans')`.
   - Wrap `<PlanBuilder planId={id} />` in `<RetirementStoreProvider initialData={{ household: plan.data, simulationConfig: plan.data.simulationConfig || defaultSimulationConfig }}>`.

4. **Create `src/components/PlanBuilder.tsx`**:
   - Client Component utilizing `useRetirementStore()`.
   - Render a beautiful An-yen tab navigation bar for the 7 tabs: Household, Accounts, Spending, Pensions, Life Events, Simulation, Summary.
   - Implement clean form inputs in each tab view to update `household` and `simulationConfig`.
   - Implement `handleSave` utilizing `useTransition` / `useState` loading state, calling `savePlan({ ...household, id: planId || household.id, simulationConfig })`, and handling success (`router.push('/plans')` or `router.refresh()`) and error notifications.

5. **Create `__tests__/planner/planBuilder.spec.tsx`**:
   - Mock `next/navigation`, `next/cache`, `@/app/actions/retirementActions`.
   - Write comprehensive test cases covering: default rendering, clicking through all 7 tabs, changing form values in each tab view, triggering `savePlan`, and handling save success/failure states.

---

## 5. Verification Method
To independently verify the success of the implementation, the receiving agent or implementer must execute the following verification steps:

1. **Unit Test Execution & Coverage**:
   Run the Jest test suite specifically targeting the planner tests to verify 100% passing status:
   ```bash
   npm run test __tests__/planner
   ```
   *Invalidation Condition*: Any failing test or console error regarding unmocked Next.js 15 router promises / server actions invalidates the verification.

2. **File Inspection**:
   Inspect the created files to ensure strict adherence to the design contracts and Next.js 15 promise conventions:
   - `src/app/plans/page.tsx`
   - `src/app/plans/new/page.tsx`
   - `src/app/plans/[id]/page.tsx`
   - `src/components/PlanBuilder.tsx`
   - `__tests__/planner/planBuilder.spec.tsx`
