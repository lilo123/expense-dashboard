# Task Description: Explorer for M4.4 - Simulation Tab & Premium Range Selector

## Objective
Analyze the codebase and recommend a comprehensive implementation strategy for Milestone 4.4: Simulation Tab & Premium Range Selector (`src/components/SimulationTab.tsx`, `src/components/PlanBuilder.tsx`, `__tests__/planner/simulationTab.spec.tsx`).

## Scope Boundaries
- Do NOT implement the code directly (you are a read-only Explorer).
- Focus strictly on `src/components/SimulationTab.tsx`, `src/components/PlanBuilder.tsx`, and `__tests__/planner/simulationTab.spec.tsx`.

## Input Information
- Project scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`
- Milestone scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m4_ui_store_1/SCOPE.md`
- Original request: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`
- Existing definitions to examine:
  - `src/components/PlanBuilder.tsx` (current inline simulation tab view)
  - `src/store/useRetirementStore.tsx` (`useRetirementStore`, `runSimulation`)
  - `src/lib/planner/types.ts` (`SimulationConfig`)

## Key Requirements to Investigate & Plan
1. **Dedicated `SimulationTab.tsx` Component (`src/components/SimulationTab.tsx`)**:
   - Extract the simulation tab view from `PlanBuilder.tsx` into a dedicated Client Component (`'use client'`).
   - Accepts `userTier?: string` as a prop.
   - Utilizes `useRetirementStore()`.
   - Renders form inputs for `retirementHorizon` and `numPaths` (500, 1000, 5000).
   - Renders the Premium Tier Historical Range Selector (20 yr / `stagflation_1970s`, 50 yr / `post_ww2_80_years`, 125 yr / `all_125_years`).
   - If `userTier !== 'premium'`, renders the An-yen frosted glass Premium Lock card over the range selector with an "Upgrade to Premium" button that invokes `router.push('/pricing')`.
   - Renders the "Run Simulation" button and displays `store.error` and `store.simulationResults` (Success Rate, Median Final Balance).
2. **Update `PlanBuilder.tsx` (`src/components/PlanBuilder.tsx`)**:
   - Import `SimulationTab` from `@/components/SimulationTab`.
   - Replace the inline simulation view (`store.activeTab === 'simulation'`) with `<SimulationTab userTier={userTier} />`.
3. **Unit Testing (`__tests__/planner/simulationTab.spec.tsx`)**:
   - 100% passing test coverage in Jest (`npm run test __tests__/planner`).
   - Test rendering of `SimulationTab` in isolation, updating horizon/paths, Premium Lock view when `userTier="free"`, clicking "Upgrade to Premium", selecting premium ranges when `userTier="premium"`, and triggering `runSimulation()`.

## Output Requirements
- Write a structured handoff report in your working directory (`handoff.md`) following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Report back via `send_message` when complete.
