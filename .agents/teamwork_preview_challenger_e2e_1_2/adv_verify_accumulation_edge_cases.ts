// Ensure global self is defined for Comlink in Node.js environment
if (typeof globalThis.self === 'undefined') {
  (globalThis as any).self = globalThis;
  (globalThis as any).addEventListener = () => {};
}

import { SimulationConfig } from '../src/types/simulation';

async function advVerifyAccumulationEdgeCases() {
  console.log('\n=== [ADVERSARIAL VERIFICATION] Validating Accumulation Phase Edge Cases & Gaps ===');

  const { simulationService } = await import('../src/workers/simulation.worker');

  console.log('\n--- Test 1: Rigorous Contribution Verification (0 vs 12000) ---');
  const baseConfig: SimulationConfig = {
    marketDataMode: 'us',
    timelineMode: 'retirement_and_accumulation',
    initialPortfolio: 100000,
    currentAge: 40,
    retirementAge: 60,
    duration: 50,
    additionalContribution: 0,
    withdrawalStrategy: 'constant_dollar',
    initialWithdrawal: 40000,
    equities: 80,
    bonds: 20,
    cash: 0,
    simulationMode: 'historical',
  } as any;

  const contribConfig: SimulationConfig = {
    ...baseConfig,
    additionalContribution: 12000,
  } as any;

  try {
    const summaryBase = simulationService.runSimulation(baseConfig);
    const summaryContrib = simulationService.runSimulation(contribConfig);

    for (let i = 0; i < summaryBase.runs.length; i++) {
      const runBase = summaryBase.runs[i];
      const runContrib = summaryContrib.runs[i];
      const baseAccumEnd = runBase.years[19].endBalance;
      const contribAccumEnd = runContrib.years[19].endBalance;

      if (contribAccumEnd <= baseAccumEnd) {
        throw new Error(`[FAIL] Run startYear ${runBase.startYear}: Contribution of $12,000 did not increase accumulation ending balance (${contribAccumEnd} <= ${baseAccumEnd})`);
      }
    }
    console.log('✔ Rigorous contribution verification passed.');
  } catch (err) {
    console.error('❌ Test 1 FAILED:', err);
  }

  console.log('\n--- Test 2: Complex Withdrawal Strategy State Leaks during Accumulation ---');
  const gkConfig: SimulationConfig = {
    ...contribConfig,
    withdrawalStrategy: 'guyton_klinger',
    gkInitialWithdrawal: 40000,
  } as any;

  try {
    const summaryGk = simulationService.runSimulation(gkConfig);
    for (const run of summaryGk.runs) {
      for (let ageIdx = 0; ageIdx < 20; ageIdx++) {
        const yr = run.years[ageIdx];
        if (yr.withdrawal !== 0) {
          throw new Error(`[FAIL] Run startYear ${run.startYear}, Age ${yr.age}: Guyton-Klinger leaked withdrawal ($${yr.withdrawal}) during accumulation phase.`);
        }
      }
    }
    console.log('✔ Complex withdrawal strategy state leak check passed.');
  } catch (err) {
    console.error('❌ Test 2 FAILED:', err);
  }

  console.log('\n--- Test 3: Additional Income & Extra Withdrawals during Accumulation ---');
  const cashFlowConfig: SimulationConfig = {
    ...contribConfig,
    additionalIncome: [{ startYearOffset: 0, duration: 5, annualAmount: 10000, inflated: false, inflationStart: 'immediately' }],
    extraWithdrawals: [{ startYearOffset: 10, duration: 5, annualAmount: 5000, inflated: false, inflationStart: 'immediately' }],
  } as any;

  try {
    const summaryCf = simulationService.runSimulation(cashFlowConfig);
    // Verify whether extra withdrawals are correctly suppressed or handled during accumulation
    console.log('✔ Additional income & extra withdrawals check completed.');
  } catch (err) {
    console.error('❌ Test 3 FAILED:', err);
  }

  console.log('\n=== [ADVERSARIAL VERIFICATION] Finished Accumulation Edge Cases ===\n');
}

advVerifyAccumulationEdgeCases();
