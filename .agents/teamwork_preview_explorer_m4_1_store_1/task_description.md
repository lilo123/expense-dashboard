# Task Description: Explorer for M4.1 - Zustand Store & URL Hydration

## Objective
Analyze the codebase and recommend a comprehensive implementation strategy for Milestone 4.1: Zustand Store & URL Hydration (`src/store/useRetirementStore.tsx`, `__tests__/planner/useRetirementStore.spec.ts`).

## Scope Boundaries
- Do NOT implement the code directly (you are a read-only Explorer).
- Focus strictly on `src/store/useRetirementStore.tsx` and `__tests__/planner/useRetirementStore.spec.ts`.

## Input Information
- Project scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`
- Milestone scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m4_ui_store_1/SCOPE.md`
- Original request: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`
- Existing definitions to examine:
  - `src/lib/planner/types.ts` (Zod schemas and types: `Household`, `SimulationConfig`, `SimulationResultsSummary`, `QuickCheckParams`)
  - `src/lib/planner/simulation.worker.ts` (Web worker message/response contracts)
  - `src/app/actions/retirementActions.ts` (Server actions for savePlan/getPlans/getPlan)

## Key Requirements to Investigate & Plan
1. **Dual-Representation Zustand Store**: `useRetirementStore` must manage:
   - `household`: Household state (with defaults/initial values).
   - `simulationConfig`: SimulationConfig state.
   - `activeTab`: active tab for the 7-tab builder (e.g., 'household', 'accounts', 'spending', 'pensions', 'lifeEvents', 'simulation', 'summary').
   - `simulationResults`: SimulationResultsSummary | null.
   - `isSimulating`: boolean flag.
   - `error`: string | null.
2. **Web Worker Integration**:
   - Background simulation execution via `src/lib/planner/simulation.worker.ts` (using `new Worker(new URL('../lib/planner/simulation.worker', import.meta.url))` or similar appropriate Web Worker instantiation in Next.js/Webpack, plus handling zero-copy IPC and fallback/mocking for Jest unit test environments).
   - Actions to trigger simulation (`runSimulation()`), update household/config/tab, etc.
3. **URL Search Params Hydration**:
   - Function/action to hydrate store state from URL search params (e.g. `hydrateFromParams(params: URLSearchParams | { [key: string]: string })`) when navigated from Quick Check widget (`/auth?redirect=/plans/new...` or `/plans/new?portfolio=1000000&withdrawal=40000&years=30&taxJurisdiction=US`).
4. **Unit Testing**:
   - 100% passing test coverage in `__tests__/planner/useRetirementStore.spec.ts` (`npm run test __tests__/planner`).
   - Mocking Zustand and Web Worker appropriately in Jest.

## Output Requirements
- Write a structured handoff report in your working directory (`handoff.md`) following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Report back via `send_message` when complete.
