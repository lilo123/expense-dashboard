# Task: Challenge M3.1 (Simulation Engine Expansion)

## Objective
Empirically verify the correctness and performance of the simulation engine expansion in `src/workers/simulation.worker.ts`.

## Requirements
1. Stress-test edge cases and verify solution correctness before acceptance.
2. Verify that when `Retirement & Accumulation Period` is active, accumulation years correctly apply zero withdrawals, add configured yearly contributions, and compound market returns.
3. Verify that when `Scrambled Monte Carlo` is active, the simulation engine generates exactly 1,000 simulation runs and results are deterministic across multiple invocations.
4. Execute verification commands:
   ```bash
   export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH
   npx tsc --noEmit
   npm run test
   npm run build
   ```
5. Write `handoff.md` in your working directory and send a completion message to your parent.
