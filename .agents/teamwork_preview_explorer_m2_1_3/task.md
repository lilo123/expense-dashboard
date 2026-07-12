# Task: Explorer 3 - M2.1 Global Market Data Ingestion (Codebase Compatibility & Type Safety Focus)

## Objective
Inspect the existing usage of `src/lib/marketData.ts` across the entire codebase (including `src/workers/simulation.worker.ts`, any UI components, and test files). Ensure that adding `mode?: 'us' | 'global'` to `getMarketDataForYear`, `getValidStartYears`, and `getAllMarketData` maintains full backwards compatibility and type safety (`npx tsc --noEmit`). Identify any potential integration risks or test updates required.

## Scope Boundaries
- Read-only exploration. Do NOT implement changes or modify source code.
- Focus on codebase-wide consumers of `marketData.ts`, TypeScript type safety, and test suite compatibility.

## Input Information
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m2_1/SCOPE.md`
- Existing Market Data: `src/lib/marketData.ts`

## Output Requirements
- Write a structured handoff report `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m2_1_3`).
- Include verified evidence chains, observations, logic chains, caveats, and conclusions.

## Completion Criteria
- `handoff.md` is written and contains a clear, actionable compatibility assessment and verification plan.
