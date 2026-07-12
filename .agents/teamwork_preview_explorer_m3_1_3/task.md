# Task: Exploration of M3.1 (Focus: Scrambled Monte Carlo Simulation Mode)

## Objective
Explore the codebase and recommend a concrete implementation strategy for `src/workers/simulation.worker.ts` to support M3.1 requirements, with a special focus on `Scrambled Monte Carlo` simulation mode.

## Key Files to Examine
- `src/workers/simulation.worker.ts`
- `src/lib/marketData.ts`
- `src/types/simulation.ts`

## Requirements
1. Analyze how `config.simulationMode === 'monte_carlo'` should be implemented.
2. Generate exactly 1,000 unique simulation runs using a seeded pseudo-random number generator (Mulberry32) so results are deterministic and reproducible across page reloads.
3. For each run, randomly sample annual returns from the available historical dataset pool (US or Global depending on `marketDataMode`).
4. Provide a detailed, verifiable implementation plan in `handoff.md`, including Mulberry32 PRNG implementation details.
5. Do NOT implement changes directly.
