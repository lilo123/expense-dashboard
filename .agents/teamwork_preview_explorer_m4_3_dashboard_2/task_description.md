# Task Description: Explorer for M4.3 - Authenticated Dashboard & 7-Tab Builder

## Objective
Analyze the codebase and recommend a comprehensive implementation strategy for Milestone 4.3: Authenticated Dashboard & 7-Tab Builder (`/plans` dashboard, `/plans/new`, `/plans/[id]`, `src/components/PlanBuilder.tsx`, `__tests__/planner/planBuilder.spec.tsx`).

## Scope Boundaries
- Do NOT implement the code directly (you are a read-only Explorer).
- Focus strictly on `src/app/plans/page.tsx`, `src/app/plans/new/page.tsx`, `src/app/plans/[id]/page.tsx`, `src/components/PlanBuilder.tsx`, and `__tests__/planner/planBuilder.spec.tsx`.

## Input Information
- Project scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`
- Milestone scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m4_ui_store_1/SCOPE.md`
- Original request: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`
- Existing definitions to examine:
  - `src/lib/planner/types.ts` (`Plan`, `Household`, `SimulationConfig`)
  - `src/app/actions/retirementActions.ts` (`getPlans`, `getPlan`, `savePlan`)
  - `src/store/useRetirementStore.tsx` (`RetirementStoreProvider`, `useRetirementStore`, `hydrateFromParams`)

## Key Requirements to Investigate & Plan
1. **Authenticated Dashboard (`src/app/plans/page.tsx`)**:
   - Server Component calling `getPlans()` server action.
   - Clean An-yen UI listing existing retirement plans, displaying plan name, primary portfolio balance, retirement horizon, and simulation status.
   - Action buttons for creating a new plan (`/plans/new`) or opening an existing plan (`/plans/[id]`).
2. **Plan Initialization Route (`src/app/plans/new/page.tsx`)**:
   - Server Component receiving URL search params (`portfolio`, `withdrawal`, `years`, `taxJurisdiction`) from `searchParams`.
   - Renders `PlanBuilder` wrapped in `RetirementStoreProvider` initialized with `initialData` derived from the search params (or a client wrapper that invokes `hydrateFromParams` on mount).
3. **Detailed Plan Builder Route (`src/app/plans/[id]/page.tsx`)**:
   - Server Component fetching existing plan via `getPlan(params.id)`. Handles 404/redirect if not found.
   - Renders `PlanBuilder` wrapped in `RetirementStoreProvider` initialized with the fetched `plan.household` and `plan.simulationConfig`.
4. **7-Tab Detailed Plan Builder SPA (`src/components/PlanBuilder.tsx`)**:
   - Client Component utilizing `useRetirementStore()`.
   - Renders 7 distinct tab views: Household, Accounts, Spending, Pensions, Life Events, Simulation, Summary.
   - Form inputs and state management to update `household` and `simulationConfig`.
   - "Save Plan" action triggering `savePlan(id, { household, simulationConfig })` server action with optimistic UI update / transition handling.
5. **Unit Testing (`__tests__/planner/planBuilder.spec.tsx`)**:
   - 100% passing test coverage in Jest (`npm run test __tests__/planner`).
   - Test rendering of all 7 tabs, navigating between tabs, updating form values, and triggering `savePlan`.

## Output Requirements
- Write a structured handoff report in your working directory (`handoff.md`) following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Report back via `send_message` when complete.
