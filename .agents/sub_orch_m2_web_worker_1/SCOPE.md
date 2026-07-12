# Scope: M2 - Web Worker Simulation Engine & Market Data

## Architecture
- Bundle 125 years of empirical market returns (1900–2025) into a static interleaved `Float64Array` (`src/content/historicalMarketData.ts`) with index offsets for 20-year and 50-year ranges.
- Implement a dedicated Web Worker (`src/lib/planner/simulation.worker.ts`) that executes 1,000 Monte Carlo block bootstrap simulation paths in parallel using in-place numerical sorting (`subarray().sort()`) and Transferable Objects for zero-copy IPC.
- Implement comprehensive unit tests in `__tests__/planner/` to verify 100% passing test coverage (`npm run test __tests__/planner`).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Historical Market Data | `src/content/historicalMarketData.ts`, `__tests__/planner/historicalMarketData.spec.ts` | M1 | DONE |
| 2 | Web Worker Simulation Engine | `src/lib/planner/simulation.worker.ts`, `__tests__/planner/simulationWorker.spec.ts` | M2.1 | DONE |

## Interface Contracts
### `src/lib/planner/simulation.worker.ts` ↔ `src/store/useRetirementStore.tsx`
- Web Worker message contract: `{ action: 'simulate', config: SimulationConfig, marketData: Float64Array }`.
- Response contract: Transferable Object containing simulation results buffer / summary.
