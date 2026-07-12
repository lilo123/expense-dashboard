// Ensure global self is defined for Comlink in Node.js environment
if (typeof globalThis.self === 'undefined') {
  (globalThis as any).self = globalThis;
  (globalThis as any).addEventListener = () => {};
}

import { simulationConfigSchema } from '../src/schemas/simulationSchema';
import { SimulationConfig } from '../src/types/simulation';

async function verifyTier3Combinations() {
  console.log('\n=== [E2E VERIFICATION] Milestone 5.3: Tier 3 Pairwise Feature Interaction Tests (8 Test Cases) ===');
  const { simulationService } = await import('../src/workers/simulation.worker');

  let failed = false;

  function assert(condition: boolean, message: string) {
    if (!condition) {
      console.error(`[FAIL] ${message}`);
      failed = true;
    } else {
      console.log(`✔ ${message}`);
    }
  }

  const baseConfig = {
    initialPortfolio: 1000000,
    duration: 30,
    equities: 60,
    bonds: 40,
    cash: 0,
    withdrawalStrategy: 'constant_dollar' as const,
    initialWithdrawal: 40000,
    currentAge: 40,
    retirementAge: 60,
    additionalContribution: 12000,
  };

  const combinations = [
    { marketDataMode: 'us', timelineMode: 'retirement_only', simulationMode: 'historical', expectedYears: 30 },
    { marketDataMode: 'us', timelineMode: 'retirement_only', simulationMode: 'monte_carlo', expectedYears: 30 },
    { marketDataMode: 'us', timelineMode: 'retirement_and_accumulation', simulationMode: 'historical', expectedYears: 50 },
    { marketDataMode: 'us', timelineMode: 'retirement_and_accumulation', simulationMode: 'monte_carlo', expectedYears: 50 },
    { marketDataMode: 'global', timelineMode: 'retirement_only', simulationMode: 'historical', expectedYears: 30 },
    { marketDataMode: 'global', timelineMode: 'retirement_only', simulationMode: 'monte_carlo', expectedYears: 30 },
    { marketDataMode: 'global', timelineMode: 'retirement_and_accumulation', simulationMode: 'historical', expectedYears: 50 },
    { marketDataMode: 'global', timelineMode: 'retirement_and_accumulation', simulationMode: 'monte_carlo', expectedYears: 50 },
  ];

  try {
    for (let i = 0; i < combinations.length; i++) {
      const combo = combinations[i];
      console.log(`\n--- Test Case ${i + 1}/8: [F1: ${combo.marketDataMode}] + [F2: ${combo.timelineMode}] + [F3: ${combo.simulationMode}] ---`);
      
      const config: SimulationConfig = {
        ...baseConfig,
        marketDataMode: combo.marketDataMode as any,
        timelineMode: combo.timelineMode as any,
        simulationMode: combo.simulationMode as any,
        withdrawalStrategy: baseConfig.withdrawalStrategy as any,
      };

      const parsed = simulationConfigSchema.safeParse(config);
      assert(parsed.success, `Zod schema validation passed for combination ${i + 1}`);

      const summary = simulationService.runSimulation(config);
      assert(summary && summary.runs && summary.runs.length > 0, `Simulation successfully executed ${summary?.runs?.length} runs`);
      assert(summary.runs[0].years.length === combo.expectedYears, `Timeline duration correctly equals ${combo.expectedYears} years (got ${summary.runs[0]?.years?.length})`);
      assert(!Number.isNaN(summary.successRate), `Success rate is valid number (${summary.successRate}%)`);
      assert(!Number.isNaN(summary.medianEndingBalance), `Median ending balance is valid number ($${summary.medianEndingBalance})`);
    }

    if (failed) {
      console.error('\n=== [E2E VERIFICATION] Tier 3 Pairwise Feature Interaction Tests FAILED ===\n');
      process.exit(1);
    } else {
      console.log('\n=== [E2E VERIFICATION] Tier 3 Pairwise Feature Interaction Tests PASSED (100% Success) ===\n');
      process.exit(0);
    }
  } catch (err) {
    console.error('=== [E2E VERIFICATION] Tier 3 Pairwise Feature Interaction Tests FAILED ===', err);
    process.exit(1);
  }
}

verifyTier3Combinations();
