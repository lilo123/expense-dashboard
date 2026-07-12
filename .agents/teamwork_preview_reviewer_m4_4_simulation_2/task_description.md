# Task Description: Reviewer for M4.4 - Simulation Tab & Premium Range Selector

## Objective
Independently review the correctness, completeness, robustness, and interface conformance of `src/components/SimulationTab.tsx`, `src/components/PlanBuilder.tsx`, `src/app/plans/new/PlanBuilderClientWrapper.tsx`, `src/content/historicalMarketData.ts`, `src/lib/planner/types.ts`, `src/lib/planner/simulation.worker.ts`, and `__tests__/planner/simulationTab.spec.tsx`. Verify 100% test success via `npm run test __tests__/planner`.

## Scope & Instructions
1. Inspect `src/components/SimulationTab.tsx`, `src/components/PlanBuilder.tsx`, `src/app/plans/new/PlanBuilderClientWrapper.tsx`, `src/content/historicalMarketData.ts`, `src/lib/planner/types.ts`, `src/lib/planner/simulation.worker.ts`, and `__tests__/planner/simulationTab.spec.tsx`.
2. Verify that the infinite render loop in `PlanBuilderClientWrapper.tsx` and the missing premium ranges in `historicalMarketData.ts` have been fully resolved.
3. Run the unit test suite to verify 100% test success:
   ```bash
   export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH
   npm run test __tests__/planner
   ```
4. Verify that NO test results or expected outputs are hardcoded, and NO dummy or facade implementations exist.
5. Write a structured handoff report in your working directory (`handoff.md`) documenting your review findings, stress test results, and verdict.
6. Report back via `send_message` when complete.
