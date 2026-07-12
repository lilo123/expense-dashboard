# Project Plan: Retirement Calculator Expansion

## Objective
Expand the Next.js retirement calculator with Global Market Data toggle, Accumulation Phase inputs, Timeline Calculation toggle, and Simulation Mode toggle (Historical Backtesting vs. Scrambled Monte Carlo).

## Milestones & Tasks
1. **M1: Core Types & Schemas Definition**
   - Define new fields in `SimulationConfig` and `simulationConfigSchema`.
2. **M2: Global Market Data Ingestion & Processing**
   - Parse `/usr/local/google/home/duynguyenn/Downloads/chart.csv` and implement `src/lib/globalMarketData.ts`.
3. **M3: Simulation Engine Expansion**
   - Implement `Retirement & Accumulation Period` logic and `Scrambled Monte Carlo` (Mulberry32 PRNG, 1,000 runs) in `src/workers/simulation.worker.ts`.
4. **M4: UI Inputs & Toggles Implementation**
   - Update `CalculatorParams.tsx` with toggles and grey-out logic; ensure views support 1,000 runs.
5. **E2E Testing Track**
   - Design opaque-box test suite and automated verification scripts (`e2e/verify_accumulation.ts`, `e2e/verify_monte_carlo.ts`). Publish `TEST_READY.md`.
6. **M5: Final Milestone**
   - Phase 1: Pass 100% E2E tests & verification scripts (`npx tsc --noEmit`, `npm run build`).
   - Phase 2: Adversarial coverage hardening.
