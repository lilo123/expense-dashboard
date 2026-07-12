# Task Description: Explorer for M4.2 - Public Quick Check Widget

## Objective
Analyze the codebase and recommend a comprehensive implementation strategy for Milestone 4.2: Public Quick Check Widget (`src/app/page.tsx` (`QuickCheckWidget.tsx`), `__tests__/planner/quickCheckWidget.spec.ts`).

## Scope Boundaries
- Do NOT implement the code directly (you are a read-only Explorer).
- Focus strictly on `src/app/page.tsx` (`QuickCheckWidget.tsx`) and `__tests__/planner/quickCheckWidget.spec.ts`.

## Input Information
- Project scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`
- Milestone scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m4_ui_store_1/SCOPE.md`
- Original request: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/ORIGINAL_REQUEST.md`
- Existing definitions to examine:
  - `src/lib/planner/types.ts` (`QuickCheckParamsSchema`, `QuickCheckParams`, `Household`, `SimulationConfig`)
  - `src/lib/planner/simulator.ts` (for executing in-memory simulations directly in the widget or via Web Worker / fallback)
  - `src/store/useRetirementStore.tsx` (Zustand store URL hydration mechanism)

## Key Requirements to Investigate & Plan
1. **Public Quick Check Widget UI (`QuickCheckWidget.tsx` / `src/app/page.tsx`)**:
   - Interactive UI elements for user inputs: `portfolio` (e.g. default $1,000,000), `withdrawal` (e.g. default $40,000), `years` (e.g. default 30), and optional `taxJurisdiction` ('US' | 'CA').
   - Visual display of in-memory simulation results (e.g., success rate, median final balance) using `simulatePath` or `handleSimulationMessage` / Web Worker directly within the widget for quick real-time feedback.
   - Action button ("Build Detailed Plan" or "Get Started") that navigates the user to `/auth?redirect=/plans/new...` or `/plans/new?portfolio=1000000&withdrawal=40000&years=30&taxJurisdiction=US` to seamlessly hydrate the Zustand store.
2. **Unit Testing (`__tests__/planner/quickCheckWidget.spec.ts`)**:
   - 100% passing test coverage in Jest (`npm run test __tests__/planner`).
   - Test user input interactions (changing portfolio, withdrawal, years), in-memory simulation execution and display, and navigation button clicking with correct URL search params.

## Output Requirements
- Write a structured handoff report in your working directory (`handoff.md`) following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).
- Report back via `send_message` when complete.
