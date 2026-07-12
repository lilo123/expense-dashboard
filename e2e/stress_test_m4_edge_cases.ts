// Ensure global self is defined for Comlink in Node.js environment
if (typeof globalThis.self === 'undefined') {
  (globalThis as any).self = globalThis;
  (globalThis as any).addEventListener = () => {};
}

import { SimulationConfig, WithdrawalStrategy } from '../src/types/simulation';
import { getAllMarketData } from '../src/lib/marketData';

async function runStressTests() {
  console.log('\n=== [STRESS TESTING HARNESS] M4 UI Inputs & Toggles Edge Cases ===');
  const { simulationService } = await import('../src/workers/simulation.worker');

  let failed = false;

  function assert(condition: boolean, message: string) {
    if (!condition) {
      console.error(`[STRESS TEST FAIL] ${message}`);
      failed = true;
    }
  }

  try {
    // 1. Market Data Integrity Verification
    console.log('\n--- 1. Verifying Market Data Integrity (US & Global) ---');
    for (const mode of ['us', 'global'] as const) {
      const data = getAllMarketData(mode);
      assert(Object.keys(data).length > 0, `Market data for ${mode} should not be empty`);
      for (const [year, point] of Object.entries(data)) {
        assert(!Number.isNaN(point.startCpi) && point.startCpi > 0, `${mode} year ${year} invalid startCpi: ${point.startCpi}`);
        assert(!Number.isNaN(point.endCpi) && point.endCpi > 0, `${mode} year ${year} invalid endCpi: ${point.endCpi}`);
        assert(!Number.isNaN(point.cape), `${mode} year ${year} invalid cape: ${point.cape}`);
        assert(!Number.isNaN(point.dividendYields), `${mode} year ${year} invalid dividendYields: ${point.dividendYields}`);
        assert(!Number.isNaN(point.stockMarketGrowth), `${mode} year ${year} invalid stockMarketGrowth: ${point.stockMarketGrowth}`);
        assert(!Number.isNaN(point.bondsGrowth), `${mode} year ${year} invalid bondsGrowth: ${point.bondsGrowth}`);
      }
    }
    console.log('✔ Market data integrity verified successfully.');

    // 2. Differential Testing: retirement_only vs retirement_and_accumulation (when currentAge == retirementAge)
    console.log('\n--- 2. Differential Testing: Timeline Modes & Ignored Inputs ---');
    const baseConfig: SimulationConfig = {
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
      currentAge: 50,
      retirementAge: 50,
      additionalContribution: 50000
    } as any;

    const summaryRetirementOnly = simulationService.runSimulation(baseConfig);
    
    const configAccumEqual: SimulationConfig = {
      ...baseConfig,
      timelineMode: 'retirement_and_accumulation',
    };
    const summaryAccumEqual = simulationService.runSimulation(configAccumEqual);

    assert(summaryRetirementOnly.successRate === summaryAccumEqual.successRate, `Differential mismatch (successRate): ${summaryRetirementOnly.successRate} vs ${summaryAccumEqual.successRate}`);
    assert(summaryRetirementOnly.medianEndingBalance === summaryAccumEqual.medianEndingBalance, `Differential mismatch (medianEndingBalance): ${summaryRetirementOnly.medianEndingBalance} vs ${summaryAccumEqual.medianEndingBalance}`);

    // Verify additionalContribution is ignored in retirement_only
    const configRetirementOnlyNoContrib: SimulationConfig = {
      ...baseConfig,
      additionalContribution: 0
    };
    const summaryRetirementOnlyNoContrib = simulationService.runSimulation(configRetirementOnlyNoContrib);
    assert(summaryRetirementOnly.medianEndingBalance === summaryRetirementOnlyNoContrib.medianEndingBalance, `additionalContribution should be ignored in retirement_only mode`);
    console.log('✔ Differential testing passed successfully.');

    // 3. Extreme Boundary & Edge Case Testing across all 13 Withdrawal Strategies
    console.log('\n--- 3. Extreme Boundary & Edge Case Testing (All 13 Strategies) ---');
    const strategies: WithdrawalStrategy[] = [
      'constant_dollar', 'percent_of_portfolio', 'one_over_n', 'vpw', 'cvpw',
      'dynamic_swr', 'guyton_klinger', 'vanguard_dynamic', 'endowment', 'rule_95',
      'cape_based', 'sensible', 'hebeler_autopilot'
    ];

    const edgeCases = [
      { name: 'Zero Portfolio & Zero Withdrawal', overrides: { initialPortfolio: 0, initialWithdrawal: 0, annualWithdrawal: 0 } },
      { name: 'Massive Portfolio & Massive Withdrawal', overrides: { initialPortfolio: 100000000, initialWithdrawal: 5000000, annualWithdrawal: 5000000 } },
      { name: 'Duration = 1 Year', overrides: { duration: 1 } },
      { name: 'Duration = 80 Years', overrides: { duration: 80, simulationMode: 'monte_carlo' } },
      { name: '100% Cash Allocation', overrides: { equities: 0, bonds: 0, cash: 100 } },
      { name: 'Negative Accumulation Window (currentAge > retirementAge)', overrides: { timelineMode: 'retirement_and_accumulation', currentAge: 70, retirementAge: 50 } },
      { name: 'Min/Max Guardrails Enabled', overrides: { minWithdrawalLimitEnabled: true, minWithdrawalLimit: 30000, maxWithdrawalLimitEnabled: true, maxWithdrawalLimit: 80000 } },
    ];

    for (const strategy of strategies) {
      for (const ec of edgeCases) {
        const testConfig: SimulationConfig = {
          ...baseConfig,
          withdrawalStrategy: strategy,
          ...ec.overrides
        } as any;

        try {
          const summary = simulationService.runSimulation(testConfig);
          assert(summary !== null && summary !== undefined, `Summary should not be null for ${strategy} (${ec.name})`);
          assert(!Number.isNaN(summary.successRate), `successRate NaN for ${strategy} (${ec.name})`);
          assert(!Number.isNaN(summary.medianEndingBalance), `medianEndingBalance NaN for ${strategy} (${ec.name})`);
          assert(summary.runs.length > 0, `Runs empty for ${strategy} (${ec.name})`);
        } catch (err: any) {
          console.error(`[STRESS TEST EXCEPTION] Strategy ${strategy} (${ec.name}) threw error: ${err.message}`);
          failed = true;
        }
      }
    }
    console.log('✔ Extreme boundary & edge case testing completed.');

    if (failed) {
      console.error('\n=== [STRESS TESTING HARNESS] FAILED ===\n');
      process.exit(1);
    } else {
      console.log('\n=== [STRESS TESTING HARNESS] ALL TESTS PASSED ===\n');
      process.exit(0);
    }
  } catch (err) {
    console.error('=== [STRESS TESTING HARNESS] UNEXPECTED FATAL ERROR ===', err);
    process.exit(1);
  }
}

runStressTests();
