# Scope: M3 - Simulation Engine Expansion (Web Worker)

## Architecture
- `src/workers/simulation.worker.ts`: Web Worker executing retirement and accumulation simulations.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M3.1: Implement Accumulation & Monte Carlo | `src/workers/simulation.worker.ts` | M1, M2 | DONE |

## Key Implementation Requirements
1. **Market Data Mode**: Pass `config.marketDataMode` to `getValidStartYears` and `getMarketDataForYear`.
2. **Timeline Calculation Toggle**:
   - If `config.timelineMode === 'retirement_and_accumulation'`, calculate accumulation years (`config.retirementAge - config.currentAge`).
   - During accumulation years: apply zero withdrawals (`withdrawal = 0`, `realWithdrawal = 0`), add `config.additionalContribution`, and compound market returns.
   - Following accumulation years: execute standard retirement withdrawal phase for `config.duration`.
3. **Simulation Mode Toggle (Scrambled Monte Carlo)**:
   - If `config.simulationMode === 'monte_carlo'`, generate exactly 1,000 unique simulation runs.
   - Use a seeded pseudo-random number generator (Mulberry32) so results are deterministic and reproducible across page reloads.
   - For each run, randomly sample annual returns from the available historical dataset pool (US or Global depending on `marketDataMode`).

## Verification Requirements
- Ensure `npx tsc --noEmit`, `npm run test`, and `npm run build` pass successfully.
