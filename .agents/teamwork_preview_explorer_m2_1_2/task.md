# Task: Explorer 2 - M2.1 Global Market Data Ingestion (Market Data Layer Focus)

## Objective
Analyze `src/lib/marketData.ts` to understand the existing US Shiller data implementation, `MarketDataPoint` interface, and existing functions (`getMarketDataForYear`, `getValidStartYears`, `getAllMarketData`). Plan the exact updates needed to support `mode?: 'us' | 'global'` while preserving existing US market data behavior and ensuring robust error handling/fallback.

## Scope Boundaries
- Read-only exploration. Do NOT implement changes or modify source code.
- Focus on `src/lib/marketData.ts` function signatures, data structures, and mode switching logic.

## Input Information
- PROJECT.md: `/usr/local/google/home/duynguyenn/expense-dashboard/PROJECT.md`
- SCOPE.md: `/usr/local/google/home/duynguyenn/expense-dashboard/.agents/sub_orch_m2_1/SCOPE.md`
- Existing Market Data: `src/lib/marketData.ts`

## Output Requirements
- Write a structured handoff report `handoff.md` in your working directory (`/usr/local/google/home/duynguyenn/expense-dashboard/.agents/teamwork_preview_explorer_m2_1_2`).
- Include verified evidence chains, observations, logic chains, caveats, and conclusions.

## Completion Criteria
- `handoff.md` is written and contains a clear, actionable recommendation for updating `src/lib/marketData.ts`.
