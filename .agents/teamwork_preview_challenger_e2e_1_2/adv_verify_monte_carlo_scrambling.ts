// Ensure global self is defined for Comlink in Node.js environment
if (typeof globalThis.self === 'undefined') {
  (globalThis as any).self = globalThis;
  (globalThis as any).addEventListener = () => {};
}

import { SimulationConfig } from '../src/types/simulation';

async function advVerifyMonteCarloScrambling() {
  console.log('\n=== [ADVERSARIAL VERIFICATION] Validating Monte Carlo Scrambling & Determinism Gaps ===');

  const { simulationService } = await import('../src/workers/simulation.worker');

  const config1: SimulationConfig = {
    marketDataMode: 'global',
    timelineMode: 'retirement_only',
    initialPortfolio: 1000000,
    duration: 30,
    withdrawalStrategy: 'constant_dollar',
    initialWithdrawal: 40000,
    equities: 60,
    bonds: 40,
    cash: 0,
    simulationMode: 'monte_carlo',
  } as any;

  const config2: SimulationConfig = {
    ...config1,
    initialPortfolio: 2000000, // Doubled portfolio to check PRNG seed stability
  } as any;

  console.log('\n--- Test 1: Statistical Distinctness of Monte Carlo Runs ---');
  try {
    const summary1 = simulationService.runSimulation(config1);
    if (summary1.runs.length < 2) {
      throw new Error(`[FAIL] Insufficient runs (${summary1.runs.length}) to verify distinctness.`);
    }

    let identicalCount = 0;
    for (let i = 0; i < summary1.runs.length - 1; i++) {
      if (summary1.runs[i].endingBalance === summary1.runs[i+1].endingBalance) {
        identicalCount++;
      }
    }

    if (identicalCount === summary1.runs.length - 1) {
      throw new Error('[FAIL] All Monte Carlo runs have identical ending balances. Scrambling is NOT occurring (runs are just cloned).');
    }
    console.log('✔ Monte Carlo runs are statistically distinct.');
  } catch (err) {
    console.error('❌ Test 1 FAILED:', err);
  }

  console.log('\n--- Test 2: PRNG Seed Stability Across Config Parameter Changes ---');
  try {
    const summary1 = simulationService.runSimulation(config1);
    const summary2 = simulationService.runSimulation(config2);

    // If PRNG seed is stable, the underlying market growth rate for Year 1, Run 1 should be identical in both summaries
    const growthRate1 = summary1.runs[0].years[0].portfolioGrowth / 1000000;
    const growthRate2 = summary2.runs[0].years[0].portfolioGrowth / 2000000;

    if (Math.abs(growthRate1 - growthRate2) > 1e-6) {
      throw new Error(`[FAIL] PRNG seed is unstable across config changes. Growth rate 1 (${growthRate1}) !== Growth rate 2 (${growthRate2})`);
    }
    console.log('✔ PRNG seed stability verified.');
  } catch (err) {
    console.error('❌ Test 2 FAILED:', err);
  }

  console.log('\n--- Test 3: Global Market Data with Long Durations (Empty Start Years) ---');
  const longConfig: SimulationConfig = {
    ...config1,
    duration: 60, // 1970 + 60 - 1 = 2029 (exceeds 2023 dataset)
  } as any;

  try {
    const summaryLong = simulationService.runSimulation(longConfig);
    if (summaryLong.totalRuns === 0) {
      console.warn('⚠️ [WARN] Duration 60 resulted in 0 totalRuns for Global Market Data. UI must handle totalRuns === 0 gracefully.');
    }
    console.log('✔ Long duration check completed.');
  } catch (err) {
    console.error('❌ Test 3 FAILED:', err);
  }

  console.log('\n=== [ADVERSARIAL VERIFICATION] Finished Monte Carlo Scrambling ===\n');
}

advVerifyMonteCarloScrambling();
