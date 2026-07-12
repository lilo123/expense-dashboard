# Scope: M5.1 Tier 1 E2E Test Pass (Feature Coverage) - Gen 2

## Architecture
- **Objective**: Execute and pass 100% of Tier 1 E2E tests (Feature Coverage - Happy-path tests) as defined in `TEST_READY.md`.
- **Methodology**: Iterate the loop: Explorer analyzes failures -> Worker fixes -> Reviewer verifies -> gate.
- **Test Runner Command**: `export PATH=$PATH:/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin && npx tsx e2e/run_e2e.ts && npx tsx e2e/verify_accumulation.ts && npx tsx e2e/verify_monte_carlo.ts` (focusing on Tier 1 / happy path passing).

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M5.1.1: Tier 1 Verification & Fix Loop | Run Explorer -> Worker -> Reviewer -> gate loop until Tier 1 tests pass (Resuming at Iteration 9) | TEST_READY.md | IN_PROGRESS |

## Interface Contracts
### `SimulationConfig` ↔ `simulation.worker.ts`
- `marketDataMode`: `'us' | 'global'`
- `timelineMode`: `'retirement_only' | 'retirement_and_accumulation'`
- `currentAge`: `number` (optional/disabled in retirement_only)
- `retirementAge`: `number` (optional/disabled in retirement_only)
- `additionalContribution`: `number` (optional/disabled in retirement_only)
- `simulationMode`: `'historical' | 'monte_carlo'`

### `marketData.ts` ↔ `simulation.worker.ts`
- `getMarketData(mode: 'us' | 'global', year: number): MarketDataPoint`
- `getValidStartYears(mode: 'us' | 'global', duration: number): number[]`
- `getAllMarketData(mode: 'us' | 'global'): MarketDataPoint[]`
