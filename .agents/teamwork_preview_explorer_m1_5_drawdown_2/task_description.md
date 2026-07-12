# Task Description: M1.5 Drawdown & Simulator Explorer 2

## Objective
Investigate the existing codebase (`src/lib/planner/types.ts`, `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`) and design the architecture and implementation strategy for `src/lib/planner/drawdownEngine.ts` and `src/lib/planner/simulator.ts`, along with their comprehensive unit tests (`__tests__/planner/drawdownEngine.spec.ts`). Focus especially on edge cases, drawdown sequence ordering (e.g., non-registered vs TFSA vs RRSP/RRIF vs taxable brokerage, tax efficiency, RMDs/minimum withdrawals), and interface contract alignment with Zod schemas.

## Scope Boundaries
- You are a read-only exploration agent. You MUST NOT create or modify source code files or test files directly.
- Recommend the exact implementation strategy, function signatures, data flows, and test scenarios.

## Input Information
- Project Scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`
- Milestone Scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m1_core_domain_1/SCOPE.md`
- Core Domain Types & Engines: `src/lib/planner/types.ts`, `taxEngine.ts`, `pensionEngine.ts`, `spendingEngine.ts`

## Output Requirements
- Write your detailed analysis and architectural strategy to `analysis.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m1_5_drawdown_2`).
- Write your handoff report to `handoff.md` in your working directory following the Handoff Protocol (Observation, Logic Chain, Caveats, Conclusion, Verification Method).

## Completion Criteria
- `analysis.md` and `handoff.md` are fully written in your working directory.
- Send a completion message to your parent orchestrator (`sub_orch_m1_core_domain_1`).
