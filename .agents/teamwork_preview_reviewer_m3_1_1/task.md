# Task: Review M3.1 (Simulation Engine Expansion)

## Objective
Examine the changes implemented in `src/workers/simulation.worker.ts` for correctness, completeness, robustness, and interface conformance.

## Requirements
1. Verify that `marketDataMode` (`'us' | 'global'`) is correctly passed to `getValidStartYears`, `getMarketDataForYear`, and `getAllMarketData`.
2. Verify `Retirement & Accumulation Period` timeline logic, ensuring correct handling of accumulation years (`config.retirementAge - config.currentAge`), zero withdrawals during accumulation, adding `additionalContribution`, compounding market returns during accumulation, and transitioning to the retirement withdrawal phase for `config.duration`.
3. Verify `Scrambled Monte Carlo` simulation mode (1,000 runs via Mulberry32 PRNG), ensuring deterministic pseudo-random sampling from the correct historical dataset pool.
4. Execute verification commands:
   ```bash
   export PATH=/usr/local/google/home/duynguyenn/.nvm/versions/node/v22.22.2/bin:$PATH
   npx tsc --noEmit
   npm run test
   npm run build
   ```
5. Check if `TEST_READY.md` exists at project root; if so, execute E2E tests as well.
6. Write `handoff.md` in your working directory and send a completion message to your parent.
