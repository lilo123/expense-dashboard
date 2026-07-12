# Task Description: Challenger for M4.4 - Simulation Tab & Premium Range Selector

## Objective
Empirically verify the correctness, completeness, and robustness of `src/components/SimulationTab.tsx`, `src/components/PlanBuilder.tsx`, `src/app/plans/new/PlanBuilderClientWrapper.tsx`, `src/content/historicalMarketData.ts`, `src/lib/planner/types.ts`, `src/lib/planner/simulation.worker.ts`, and `__tests__/planner/simulationTab.spec.tsx`. Execute the unit test suite (`npm run test __tests__/planner`) and perform adversarial stress testing.

## Scope & Instructions
1. Review `src/components/SimulationTab.tsx`, `src/components/PlanBuilder.tsx`, `src/app/plans/new/PlanBuilderClientWrapper.tsx`, `src/content/historicalMarketData.ts`, `src/lib/planner/types.ts`, `src/lib/planner/simulation.worker.ts`, and `__tests__/planner/simulationTab.spec.tsx`.
2. Execute the test suite to verify 100% test success:
   ```bash
   export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH
   npm run test __tests__/planner
   ```
3. Stress test the implementation for edge cases, unhandled promises, state leaks, profile tier fallbacks, and simulation execution.
4. Verify that the infinite render loop in `PlanBuilderClientWrapper.tsx` and the missing premium ranges in `historicalMarketData.ts` remain completely resolved under stress testing.
5. Write a structured handoff report in your working directory (`handoff.md`) documenting your stress test results and empirical verification.
6. Report back via `send_message` when complete.
