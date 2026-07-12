# Task: Exploration of M3.1 (Focus: Market Data Mode Integration)

## Objective
Explore the codebase and recommend a concrete implementation strategy for `src/workers/simulation.worker.ts` to support M3.1 requirements, with a special focus on `marketDataMode` (`'us' | 'global'`).

## Key Files to Examine
- `src/workers/simulation.worker.ts`
- `src/lib/marketData.ts`
- `src/lib/globalMarketData.ts`
- `src/types/simulation.ts`
- `src/schemas/simulationSchema.ts`

## Requirements
1. Analyze how `config.marketDataMode` should be passed to `getValidStartYears`, `getMarketDataForYear`, `getAllMarketData`, etc.
2. Verify existing functions and contracts in `src/lib/marketData.ts`.
3. Provide a detailed, verifiable implementation plan in `handoff.md`.
4. Do NOT implement changes directly.
