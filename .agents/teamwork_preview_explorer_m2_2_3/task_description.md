# Task Description: M2.2 Web Worker Simulation Engine Exploration

## Objective
Explore the requirements and architecture for M2.2 Web Worker Simulation Engine and recommend an implementation and testing strategy. Do NOT implement the changes yourself.

## Scope Boundaries
- Target files to analyze/plan: `src/lib/planner/simulation.worker.ts` and `__tests__/planner/simulationWorker.spec.ts`.
- Do NOT create or modify source code or test files directly.

## Input Information
- Project Scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`
- Milestone Scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m2_web_worker_1/SCOPE.md`
- Base Types: `/usr/local/google/home/duynguyenn/expense-dashboard/src/lib/planner/types.ts`
- Market Data: `/usr/local/google/home/duynguyenn/expense-dashboard/src/content/historicalMarketData.ts`

## Key Technical Requirements to Plan
1. **Web Worker Message Contract**: `{ action: 'simulate', config: SimulationConfig, marketData: Float64Array, household?: Household }`.
2. **Monte Carlo Simulation Engine**: Execute 1,000 block bootstrap simulation paths (sampling from the provided empirical `marketData` Float64Array based on `config.historicalRange`).
3. **Performance & IPC**: Use in-place numerical sorting (`subarray().sort()`) for calculating percentiles (p10, p50, p90) and Transferable Objects for zero-copy IPC response.
4. **Drawdown & Cash Flows**: Support `SimulationConfig` drawdown strategies (`taxable_first`, `proportional`, `tax_deferred_first`), inflation adjustments, and optional `Household` cash flows (accounts, spending, pensions, lifeEvents).
5. **Comprehensive Unit Testing**: Plan `__tests__/planner/simulationWorker.spec.ts` to mock/test the Web Worker and verify 100% passing test coverage (`npm run test __tests__/planner`).

## Output Requirements
- Write your exploration report and `handoff.md` in your working directory: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m2_2_3`.
- Follow the Handoff Protocol: Observation, Logic Chain, Caveats, Conclusion, Verification Method.

## Completion Criteria
- A comprehensive, verified architectural plan and strategy delivered in `handoff.md`, ready for the Worker to implement.
