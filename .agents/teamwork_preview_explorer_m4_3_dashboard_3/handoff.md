# Handoff Report: Milestone 4.3 - Authenticated Dashboard & 7-Tab Builder

## 1. Observation
During our read-only investigation of the `expense-dashboard` codebase and Next.js documentation, we directly observed the following critical architectural contracts and breaking changes:

- **Next.js Canary Breaking Changes (`node_modules/next/dist/docs/01-app/02-guides/instant-navigation.md`)**:
  - `params` and `searchParams` in Server Components are `Promise` objects. As shown in the official guide (`params: Promise<{ slug: string }>`), they must be awaited (`await params`, `await searchParams`) before accessing properties like `params.id` or `searchParams.portfolio`.
  - For dynamic routes/layouts that read cookies or fetch user-specific data (such as authenticated dashboards), the guide explicitly specifies opting out of instant static validation by exporting `export const unstable_instant = false;` (Lines 273-282).

- **Server Actions Contract (`src/app/actions/retirementActions.ts`)**:
  - `getPlans()` (Lines 31-59) returns `Promise<{ success: boolean; data?: Household[]; error?: string }>`.
  - `getPlan(id: string)` (Lines 61-91) returns `Promise<{ success: boolean; data?: Household; error?: string }>`.
  - `savePlan(planData: unknown)` (Lines 93-171) takes a **single argument** `planData`, which is validated via `HouseholdSchema.safeParse(planData)`. It extracts `id` and `user_id` from the parsed object to determine whether to execute an `UPDATE` or `INSERT`.

- **Household & Simulation Config Schema (`src/lib/planner/types.ts`)**:
  - `HouseholdSchema` (Lines 110-140) defines the full structure of a retirement plan, which embeds `simulationConfig: SimulationConfigSchema.optional()`. 

- **Zustand Store & Hydration (`src/store/useRetirementStore.tsx`)**:
  - `RetirementStoreProvider` (Lines 301-318) initializes the store with `initialData?: Partial<RetirementState>`.
  - `hydrateFromParams` (Lines 125-200) parses `portfolio`, `withdrawal`, `years`, `taxJurisdiction` from `URLSearchParams` or a plain object to update `household` and `simulationConfig`.

- **An-yen UI Styling & Premium Entitlement**:
  - `QuickCheckWidget.tsx` establishes the An-yen UI aesthetic using frosted glass cards (`bg-white/80 backdrop-blur-md border border-white/40 rounded-3xl shadow-xl text-zen-charcoal`) and elegant charcoal buttons (`bg-zen-charcoal text-white rounded-2xl font-bold`).
  - `requirePremiumUser` in `retirementActions.ts` queries `profiles.tier`. To enforce the Premium Lock card on the Simulation tab without making duplicate client-side requests, `profiles.tier` can be queried server-side in `/plans/new` and `/plans/[id]` using `createClient()` from `@/utils/supabase/server` and passed to `PlanBuilder` as a prop.

---

## 2. Logic Chain

1. **Next.js Route Opt-Out & Promise Unwrapping**:
   - Because `src/app/plans/page.tsx`, `src/app/plans/new/page.tsx`, and `src/app/plans/[id]/page.tsx` represent authenticated, user-specific views, all three files MUST export `export const unstable_instant = false;` to prevent build-time static validation failures.
   - In `src/app/plans/new/page.tsx`, `searchParams` must be unwrapped via `const resolvedParams = await searchParams;`.
   - In `src/app/plans/[id]/page.tsx`, `params` must be unwrapped via `const resolvedParams = await params;` before calling `getPlan(resolvedParams.id)`.

2. **`savePlan` Parameter Alignment**:
   - The task description informally mentions calling `savePlan(id, { household, simulationConfig })`. However, `savePlan` in `retirementActions.ts` accepts only a single object (`planData: unknown`) and validates it against `HouseholdSchema`.
   - Therefore, `PlanBuilder.tsx` must construct the payload as a unified `Household` object: `const planPayload = { ...store.household, simulationConfig: store.simulationConfig };` and call `savePlan(planPayload)`. If `store.household.id` is present, `savePlan` automatically performs an update; otherwise, an insert.

3. **Store Initialization in `/plans/new` vs `/plans/[id]`**:
   - In `src/app/plans/[id]/page.tsx`, we fetch the existing plan via `getPlan(id)`. We wrap `PlanBuilder` in `<RetirementStoreProvider initialData={{ household: plan, simulationConfig: plan.simulationConfig || defaultSimulationConfig }}>`.
   - In `src/app/plans/new/page.tsx`, we receive URL parameters. To properly hydrate the store without duplicating parsing logic or risking server/client hydration mismatches, we can render a client wrapper `<PlanBuilderClientWrapper searchParams={resolvedParams} userTier={userTier} />` which renders `<RetirementStoreProvider>` and uses `useLayoutEffect`/`useEffect` to call `store.hydrateFromParams(searchParams)` on mount.

4. **Premium Lock Card Enforcement**:
   - Both `/plans/new` and `/plans/[id]` should fetch the user's profile tier server-side:
     ```typescript
     const supabase = await createClient();
     const { data: authData } = await supabase.auth.getUser();
     const { data: profile } = await supabase.from('profiles').select('tier').eq('id', authData?.user?.id).single();
     const userTier = profile?.tier || 'free';
     ```
   - `PlanBuilder` receives `userTier` as a prop. In the Simulation tab view, if `userTier !== 'premium'`, it renders the An-yen frosted glass Premium Lock card over the Historical Range Selector (20 yr, 50 yr, 125 yr) with an elegant message explaining the premium entitlement.

5. **7-Tab Plan Builder SPA Structure**:
   - `PlanBuilder.tsx` utilizes `const store = useRetirementStore();`.
   - A tab header component allows switching `store.activeTab` between `'household' | 'accounts' | 'spending' | 'pensions' | 'lifeEvents' | 'simulation' | 'summary'`.
   - Each tab renders clean An-yen form controls to mutate state via `store.updateHousehold`, `store.updateSimulationConfig`, or `store.runSimulation()`.
   - A global "Save Plan" button utilizes `useTransition()` to show loading state during the server action call, displaying success/error feedback cleanly upon completion.

---

## 3. Caveats
- **Read-Only Scope**: As an Explorer agent, no code has been modified. All findings are derived from static analysis of existing files and documentation.
- **Supabase Authentication**: During Jest unit testing in `__tests__/planner/planBuilder.spec.tsx`, server-side Supabase calls (`createClient()`) and Next.js navigation (`useRouter`, `useParams`, `useSearchParams`) must be mocked appropriately, matching the established pattern in `quickCheckWidget.spec.tsx`.

---

## 4. Conclusion
The implementation of Milestone 4.3 can proceed cleanly and surgically by adhering to the following explicit file structures:

### `src/app/plans/page.tsx`
```tsx
import React from 'react';
import Link from 'next/link';
import { getPlans } from '@/app/actions/retirementActions';

export const unstable_instant = false;

export default async function PlansDashboardPage() {
  const res = await getPlans();

  if (!res.success) {
    return (
      <div className="min-h-screen bg-zen-base p-8 flex flex-col items-center justify-center text-zen-charcoal">
        <div className="p-6 bg-white/80 backdrop-blur-md border border-white/40 rounded-3xl shadow-xl max-w-md text-center">
          <h2 className="text-2xl font-black mb-2">Access Restricted</h2>
          <p className="text-sm text-zen-charcoal/70 mb-6">{res.error || 'Please log in to view your retirement plans.'}</p>
          <Link href="/dashboard" className="px-6 py-3 bg-zen-charcoal text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-zen-charcoal/90 transition-all">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const plans = res.data || [];

  return (
    <div className="min-h-screen bg-zen-base p-6 sm:p-12 text-zen-charcoal">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight">Retirement Plans</h1>
            <p className="text-sm text-zen-charcoal/70 font-semibold mt-1">Manage and simulate your mindful wealth strategies</p>
          </div>
          <Link href="/plans/new" className="px-6 py-3 bg-zen-charcoal text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-zen-charcoal/90 transition-all active:scale-[0.99]">
            + Create New Plan
          </Link>
        </div>

        {plans.length === 0 ? (
          <div className="p-12 bg-white/80 backdrop-blur-md border border-white/40 rounded-3xl shadow-xl text-center flex flex-col items-center justify-center gap-4">
            <h2 className="text-2xl font-black">No Retirement Plans Found</h2>
            <p className="text-sm text-zen-charcoal/70 max-w-md">Start planning your mindful wealth future by creating your first retirement plan today.</p>
            <Link href="/plans/new" className="mt-2 px-6 py-3 bg-zen-charcoal text-white rounded-2xl font-bold text-sm shadow-lg hover:bg-zen-charcoal/90 transition-all">
              Create Your First Plan
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const primaryAccount = plan.accounts?.[0];
              const balance = primaryAccount?.balance || 0;
              const horizon = plan.simulationConfig?.retirementHorizon || 30;
              return (
                <div key={plan.id} className="p-6 bg-white/80 backdrop-blur-md border border-white/40 rounded-3xl shadow-xl flex flex-col justify-between gap-6 hover:shadow-2xl transition-all group">
                  <div>
                    <h3 className="text-xl font-black group-hover:text-zen-charcoal transition-colors">{plan.name}</h3>
                    <p className="text-xs text-zen-charcoal/60 font-bold uppercase tracking-wider mt-1">{plan.taxJurisdiction} • {plan.stateProvince}</p>
                    <div className="mt-6 flex justify-between items-center border-t border-zen-charcoal/10 pt-4">
                      <span className="text-xs font-bold text-zen-charcoal/70">Portfolio Balance</span>
                      <span className="text-lg font-black">${Math.round(balance).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-xs font-bold text-zen-charcoal/70">Horizon</span>
                      <span className="text-sm font-bold">{horizon} Years</span>
                    </div>
                  </div>
                  <Link href={`/plans/${plan.id}`} className="w-full py-3 bg-zen-charcoal/10 hover:bg-zen-charcoal text-zen-charcoal hover:text-white rounded-2xl font-bold text-sm text-center transition-all">
                    Open Plan Builder
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

### `src/app/plans/new/page.tsx`
```tsx
import React from 'react';
import { createClient } from '@/utils/supabase/server';
import PlanBuilderClientWrapper from './PlanBuilderClientWrapper';

export const unstable_instant = false;

export default async function NewPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const resolvedParams = await searchParams;
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', authData?.user?.id)
    .single();

  return <PlanBuilderClientWrapper searchParams={resolvedParams} userTier={profile?.tier || 'free'} />;
}
```
*(With a co-located `PlanBuilderClientWrapper.tsx` that wraps `PlanBuilder` in `RetirementStoreProvider` and calls `store.hydrateFromParams` on mount).*

### `src/app/plans/[id]/page.tsx`
```tsx
import React from 'react';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getPlan } from '@/app/actions/retirementActions';
import { RetirementStoreProvider, defaultSimulationConfig } from '@/store/useRetirementStore';
import PlanBuilder from '@/components/PlanBuilder';

export const unstable_instant = false;

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const res = await getPlan(resolvedParams.id);

  if (!res.success || !res.data) {
    notFound();
  }

  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', authData?.user?.id)
    .single();

  return (
    <RetirementStoreProvider initialData={{ household: res.data, simulationConfig: res.data.simulationConfig || defaultSimulationConfig }}>
      <PlanBuilder userTier={profile?.tier || 'free'} />
    </RetirementStoreProvider>
  );
}
```

### `src/components/PlanBuilder.tsx`
- Renders the 7 tab views cleanly.
- Implements the An-yen frosted glass Premium Lock card on the Simulation tab if `userTier !== 'premium'`.
- Implements `savePlan` using `useTransition()` with `const planPayload = { ...store.household, simulationConfig: store.simulationConfig };`.

### `__tests__/planner/planBuilder.spec.tsx`
- Thoroughly tests rendering of all 7 tabs, switching active tabs, editing inputs, verifying Premium Lock view when `userTier="free"`, and verifying `savePlan` call upon clicking "Save Plan".

---

## 5. Verification Method
To independently verify the success of the implementation once completed, execute the following commands:

1. **Unit Test Verification**:
   ```bash
   npm run test __tests__/planner/planBuilder.spec.tsx
   ```
   *Expected outcome: 100% passing tests for the Plan Builder suite.*

2. **Full Planner Unit Test Suite**:
   ```bash
   npm run test __tests__/planner
   ```
   *Expected outcome: All existing and new tests pass successfully.*

3. **Static Build & Next.js Canary Validation**:
   ```bash
   npm run build
   ```
   *Expected outcome: Next.js builds successfully with zero static validation errors or unhandled Promise rejections for params/searchParams.*

4. **E2E Integration & Accessibility Audit**:
   ```bash
   npx tsx e2e/run_e2e.ts
   ```
   *Expected outcome: Playwright E2E tests complete successfully with zero WCAG 2.1 AA/AAA accessibility violations.*
