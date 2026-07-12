// Ensure global self is defined for Comlink in Node.js environment
if (typeof globalThis.self === 'undefined') {
  (globalThis as any).self = globalThis;
  (globalThis as any).addEventListener = () => {};
}

import { simulationConfigSchema } from '../src/schemas/simulationSchema';
import { SimulationConfig } from '../src/types/simulation';

async function verifyMonteCarlo() {
  console.log('\n=== [E2E VERIFICATION] Validating F3 Scrambled Monte Carlo Simulation Engine (Tier 2 Boundary & Corner Cases) ===');

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

  const config: SimulationConfig = {
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
  } as any; // Cast as any until types are updated in M1

  try {
    // 1. Zod defaults & validation
    console.log('\n--- 1. Zod Defaults & Validation ---');
    const parsed = simulationConfigSchema.safeParse(config);
    assert(parsed.success && parsed.data.simulationMode === 'monte_carlo', 'Zod schema correctly validates and defaults Monte Carlo simulationMode');

    // 2. Exact 1,000 run count
    console.log('\n--- 2. Exact 1,000 Run Count ---');
    console.log('Executing first Scrambled Monte Carlo invocation...');
    const summary1 = simulationService.runSimulation(config);
    if (!summary1 || !summary1.runs) {
      throw new Error('First Monte Carlo simulation returned invalid summary.');
    }
    assert(summary1.runs.length === 1000 && summary1.totalRuns === 1000, `Invocation 1 correctly generated exactly 1,000 simulation runs (got ${summary1.runs.length})`);

    // 3. PRNG determinism
    console.log('\n--- 3. PRNG Determinism ---');
    console.log('Executing second Scrambled Monte Carlo invocation with identical config...');
    const summary2 = simulationService.runSimulation(config);
    if (!summary2 || !summary2.runs) {
      throw new Error('Second Monte Carlo simulation returned invalid summary.');
    }
    assert(summary2.runs.length === 1000 && summary2.totalRuns === 1000, `Invocation 2 correctly generated exactly 1,000 simulation runs (got ${summary2.runs.length})`);

    let determinismMatch = summary1.successRate === summary2.successRate && summary1.medianEndingBalance === summary2.medianEndingBalance;
    for (let i = 0; i < 5; i++) {
      if (summary1.runs[i].endingBalance !== summary2.runs[i].endingBalance) {
        determinismMatch = false;
      }
    }
    assert(determinismMatch, 'Scrambled Monte Carlo results are 100% deterministic and reproducible across invocations');

    // 4. 125-year extreme timeline stress
    console.log('\n--- 4. 125-Year Extreme Timeline Stress ---');
    const stressConfig: SimulationConfig = {
      ...config,
      timelineMode: 'retirement_and_accumulation',
      currentAge: 20,
      retirementAge: 80, // 60 years accumulation
      duration: 65,      // 65 years retirement -> 125 years total
      additionalContribution: 50000
    } as any;
    const stressSummary = simulationService.runSimulation(stressConfig);
    assert(stressSummary && stressSummary.runs && stressSummary.runs.length === 1000 && stressSummary.runs[0].years.length === 125, `Successfully executed 1,000 Monte Carlo runs under 125-year extreme timeline stress (got ${stressSummary?.runs?.[0]?.years?.length} years)`);

    // 5. Zero-copy columnar buffer integrity
    console.log('\n--- 5. Zero-Copy Columnar Buffer Integrity ---');
    assert(!!stressSummary.balancesBuffer && !!stressSummary.withdrawalsBuffer && !!stressSummary.growthBuffer, 'Columnar typed array buffers (balancesBuffer, withdrawalsBuffer, growthBuffer) exist in simulation summary');
    assert(stressSummary.balancesBuffer?.length === 1000 * 125, `Columnar buffers have correct length for zero-copy transfer (expected 125,000, got ${stressSummary.balancesBuffer?.length})`);

    if (failed) {
      console.error('\n=== [E2E VERIFICATION] Monte Carlo Verification FAILED ===\n');
      process.exit(1);
    } else {
      console.log('\n=== [E2E VERIFICATION] Monte Carlo Verification PASSED ===\n');
      process.exit(0);
    }
  } catch (err) {
    console.error('=== [E2E VERIFICATION] Monte Carlo Verification FAILED ===', err);
    process.exit(1);
  }
}

verifyMonteCarlo();
