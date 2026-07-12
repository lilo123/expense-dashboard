# Task Description: Forensic Auditor for M4.4 - Simulation Tab & Premium Range Selector

## Objective
Perform forensic integrity verification on `src/components/SimulationTab.tsx`, `src/components/PlanBuilder.tsx`, `src/app/plans/new/PlanBuilderClientWrapper.tsx`, `src/content/historicalMarketData.ts`, `src/lib/planner/types.ts`, `src/lib/planner/simulation.worker.ts`, and `__tests__/planner/simulationTab.spec.tsx` to ensure all implementations are genuine, robust, and free of integrity violations or test shortcuts.

## Scope & Instructions
1. Inspect `src/components/SimulationTab.tsx`, `src/components/PlanBuilder.tsx`, `src/app/plans/new/PlanBuilderClientWrapper.tsx`, `src/content/historicalMarketData.ts`, `src/lib/planner/types.ts`, `src/lib/planner/simulation.worker.ts`, and `__tests__/planner/simulationTab.spec.tsx`.
2. Verify that NO test results or expected outputs are hardcoded, NO dummy or facade implementations exist, and NO test-specific backdoor flags remain in production code.
3. Run the unit test suite to independently verify 100% test success:
   ```bash
   export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH
   npm run test __tests__/planner
   ```
4. Confirm that the implementation genuinely satisfies the product requirements and adheres to the Integrity Mandate.
5. Write a structured handoff report in your working directory (`handoff.md`) documenting your forensic audit findings and clean verdict.
6. Report back via `send_message` when complete.
