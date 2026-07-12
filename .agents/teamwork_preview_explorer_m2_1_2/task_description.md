# Task Description: M2.1 Historical Market Data Exploration (Explorer 2)

## Objective
Analyze the requirements and existing codebase for M2.1 (Historical Market Data) and recommend an implementation strategy for `src/content/historicalMarketData.ts` and `__tests__/planner/historicalMarketData.spec.ts`.

## Scope Boundaries
- Recommend fix/implementation strategy but DO NOT implement code directly.
- Focus on `src/content/historicalMarketData.ts` and `__tests__/planner/historicalMarketData.spec.ts`.

## Input Information
- Project Scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/orchestrator/PROJECT.md`
- Milestone Scope: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m2_web_worker_1/SCOPE.md`
- Milestone 1 Base Types: `src/lib/planner/types.ts`

## Requirements to Analyze
- Bundle 125 years of empirical market returns (1900–2025) into a static interleaved `Float64Array` (`src/content/historicalMarketData.ts`).
- Interleaved structure should support stock returns, bond returns, and inflation rates (or relevant asset classes per simulation requirements).
- Provide index offsets/helpers for 20-year (`most_recent_20_years`), 50-year (`most_recent_50_years`), and 125-year (`all_125_years`) ranges.
- Comprehensive unit tests in `__tests__/planner/historicalMarketData.spec.ts` verifying 100% test coverage.

## Output Requirements
- Write your investigation and recommendation report to `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m2_1_2`).

## Completion Criteria
- A complete, self-contained `handoff.md` with Observation, Logic Chain, Caveats, Conclusion, and Verification Method.
